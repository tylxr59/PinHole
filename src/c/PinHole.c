#include <pebble.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

#define VIEW_X 0
#define VIEW_Y 28
#define VIEW_W 200
#define VIEW_H 172

#define PERSIST_SELECTED_CAMERA 1
#define REQUEST_TIMEOUT_MS 30000
#define UPDATED_NOW_WINDOW_SECS 30
#define STATUS_REDRAW_INTERVAL_MS 10000
#define BACKLIGHT_HOLD_MS 30000

typedef enum {
  APP_STATUS_EMPTY = 0,
  APP_STATUS_LOADING,
  APP_STATUS_READY,
  APP_STATUS_ERROR
} AppStatus;

static Window *s_window;
static Layer *s_layer;
static GBitmap *s_bitmap;
static uint8_t *s_frame;
static uint32_t s_frame_len;
static uint32_t s_frame_received;
static int s_frame_w;
static int s_frame_h;

static int s_camera_count;
static int s_camera_index;
static uint32_t s_request_seq;
static uint32_t s_active_frame_seq;
static bool s_waiting_for_frame;
static AppTimer *s_request_timeout_timer;
static AppTimer *s_status_redraw_timer;
static AppTimer *s_backlight_timer;
static uint32_t s_last_updated;
static AppStatus s_status;
static char s_camera_name[40];
static char s_error[48];

static void prv_mark_dirty(void) {
  if (s_layer) {
    layer_mark_dirty(s_layer);
  }
}

static void prv_cancel_request_timeout(void) {
  if (s_request_timeout_timer) {
    app_timer_cancel(s_request_timeout_timer);
    s_request_timeout_timer = NULL;
  }
}

static void prv_cancel_status_redraw(void) {
  if (s_status_redraw_timer) {
    app_timer_cancel(s_status_redraw_timer);
    s_status_redraw_timer = NULL;
  }
}

static void prv_release_backlight(void *context) {
  (void)context;
  s_backlight_timer = NULL;
  light_enable(false);
}

static void prv_hold_backlight(void) {
  light_enable(true);
  if (s_backlight_timer) {
    app_timer_cancel(s_backlight_timer);
  }
  s_backlight_timer = app_timer_register(
      BACKLIGHT_HOLD_MS, prv_release_backlight, NULL);
}

static void prv_schedule_status_redraw(void);

static void prv_status_redraw(void *context) {
  (void)context;
  s_status_redraw_timer = NULL;
  prv_mark_dirty();
  prv_schedule_status_redraw();
}

static void prv_schedule_status_redraw(void) {
  prv_cancel_status_redraw();
  if (s_status == APP_STATUS_READY && s_last_updated) {
    s_status_redraw_timer = app_timer_register(
        STATUS_REDRAW_INTERVAL_MS, prv_status_redraw, NULL);
  }
}

static void prv_set_error(const char *message) {
  prv_cancel_request_timeout();
  s_status = APP_STATUS_ERROR;
  s_waiting_for_frame = false;
  strncpy(s_error, message ? message : "ERROR", sizeof(s_error) - 1);
  s_error[sizeof(s_error) - 1] = '\0';
  prv_mark_dirty();
}

static void prv_request_timeout(void *context) {
  uint32_t seq = (uint32_t)(uintptr_t)context;
  s_request_timeout_timer = NULL;
  if (s_waiting_for_frame && seq == s_active_frame_seq) {
    prv_set_error("PHONE TIMEOUT");
  }
}

static void prv_free_frame(void) {
  if (s_bitmap) {
    gbitmap_destroy(s_bitmap);
    s_bitmap = NULL;
  }
  if (s_frame) {
    free(s_frame);
    s_frame = NULL;
  }
  s_frame_len = 0;
  s_frame_received = 0;
  s_frame_w = 0;
  s_frame_h = 0;
}

static void prv_request_frame(void) {
  DictionaryIterator *iter;
  if (app_message_outbox_begin(&iter) != APP_MSG_OK) {
    prv_set_error("OUTBOX BUSY");
    return;
  }

  s_request_seq++;
  s_active_frame_seq = s_request_seq;
  s_waiting_for_frame = true;
  s_status = APP_STATUS_LOADING;
  s_error[0] = '\0';

  dict_write_uint8(iter, MESSAGE_KEY_RequestFrame, 1);
  dict_write_uint32(iter, MESSAGE_KEY_RequestSeq, s_request_seq);
  dict_write_int32(iter, MESSAGE_KEY_CameraIndex, s_camera_index);
  dict_write_end(iter);
  app_message_outbox_send();
  prv_cancel_request_timeout();
  s_request_timeout_timer = app_timer_register(
      REQUEST_TIMEOUT_MS, prv_request_timeout,
      (void *)(uintptr_t)s_active_frame_seq);
  prv_mark_dirty();
}

static void prv_select_camera(int delta) {
  if (s_camera_count > 0) {
    s_camera_index += delta;
    while (s_camera_index < 0) {
      s_camera_index += s_camera_count;
    }
    s_camera_index %= s_camera_count;
    persist_write_int(PERSIST_SELECTED_CAMERA, s_camera_index);
  }
  prv_request_frame();
}

static void prv_format_updated(char *out, size_t n) {
  if (!s_last_updated) {
    snprintf(out, n, "UPDATED --");
    return;
  }

  uint32_t now = (uint32_t)time(NULL);
  if (now <= s_last_updated || now - s_last_updated < UPDATED_NOW_WINDOW_SECS) {
    snprintf(out, n, "UPDATED NOW");
    return;
  }

  uint32_t delta = now - s_last_updated;
  if (delta < 60) {
    snprintf(out, n, "UPDATED NOW");
  } else if (delta < 3600) {
    snprintf(out, n, "UPDATED %luM AGO", (unsigned long)(delta / 60));
  } else if (delta < 86400) {
    snprintf(out, n, "UPDATED %luH AGO", (unsigned long)(delta / 3600));
  } else {
    snprintf(out, n, "UPDATED %luD AGO", (unsigned long)(delta / 86400));
  }
}

static void prv_draw_centered_text(GContext *ctx, GRect rect, const char *text,
                                   GFont font, GColor color) {
  graphics_context_set_text_color(ctx, color);
  graphics_draw_text(ctx, text, font, rect, GTextOverflowModeTrailingEllipsis,
                     GTextAlignmentCenter, NULL);
}

static void prv_draw_text(GContext *ctx, GRect rect, const char *text,
                          GFont font, GColor color,
                          GTextAlignment alignment) {
  graphics_context_set_text_color(ctx, color);
  graphics_draw_text(ctx, text, font, rect, GTextOverflowModeTrailingEllipsis,
                     alignment, NULL);
}

static const char *prv_error_hint(void) {
  if (strcmp(s_error, "PHONE TIMEOUT") == 0) {
    return "CHECK PHONE";
  }
  return "SELECT TO RETRY";
}

static void prv_layer_update(Layer *layer, GContext *ctx) {
  GRect bounds = layer_get_bounds(layer);
  graphics_context_set_fill_color(ctx, GColorBlack);
  graphics_fill_rect(ctx, bounds, 0, GCornerNone);

  GRect header = GRect(0, 0, bounds.size.w, VIEW_Y);
  GRect viewport = GRect(VIEW_X, VIEW_Y, VIEW_W, VIEW_H);
  GRect footer = GRect(0, VIEW_Y + VIEW_H, bounds.size.w, bounds.size.h - VIEW_Y - VIEW_H);

  graphics_context_set_fill_color(ctx, GColorWhite);
  graphics_fill_rect(ctx, header, 0, GCornerNone);

  const char *title = s_camera_name[0] ? s_camera_name : "PinHole";
  prv_draw_text(ctx, GRect(6, header.origin.y + 2, bounds.size.w - 58, 24),
                title, fonts_get_system_font(FONT_KEY_GOTHIC_18_BOLD),
                GColorBlack, GTextAlignmentLeft);

  char index_text[24];
  if (s_camera_count > 0) {
    snprintf(index_text, sizeof(index_text), "%d/%d",
             s_camera_index + 1, s_camera_count);
  } else {
    snprintf(index_text, sizeof(index_text), "--");
  }
  prv_draw_text(ctx, GRect(bounds.size.w - 48, header.origin.y + 4, 42, 24),
                index_text, fonts_get_system_font(FONT_KEY_GOTHIC_14_BOLD),
                GColorBlack, GTextAlignmentRight);

  graphics_context_set_stroke_color(ctx, GColorBlack);
  graphics_draw_line(ctx, GPoint(0, VIEW_Y - 1), GPoint(bounds.size.w, VIEW_Y - 1));

  graphics_context_set_fill_color(ctx, GColorBlack);
  graphics_fill_rect(ctx, viewport, 0, GCornerNone);

  if (s_bitmap && (s_status == APP_STATUS_READY || s_waiting_for_frame)) {
    GRect image_rect = GRect(viewport.origin.x + (viewport.size.w - s_frame_w) / 2,
                             viewport.origin.y + (viewport.size.h - s_frame_h) / 2,
                             s_frame_w, s_frame_h);
    graphics_draw_bitmap_in_rect(ctx, s_bitmap, image_rect);
  } else {
    const char *msg = "NO FRAME";
    const char *hint = "SELECT REFRESH";
    GColor color = GColorLightGray;
    if (s_status == APP_STATUS_LOADING) {
      msg = "REFRESHING...";
      hint = "PLEASE WAIT";
      color = GColorYellow;
    } else if (s_status == APP_STATUS_ERROR) {
      msg = s_error[0] ? s_error : "ERROR";
      hint = prv_error_hint();
      color = GColorRed;
    } else if (s_camera_count == 0) {
      msg = "OPEN PHONE SETTINGS";
      hint = "ADD CAMERAS";
    } else {
      msg = "SELECT REFRESH";
      hint = "UP/DOWN CAMERAS";
    }
    prv_draw_centered_text(ctx, GRect(viewport.origin.x + 6, viewport.origin.y + 58,
                                      viewport.size.w - 12, 28),
                           msg, fonts_get_system_font(FONT_KEY_GOTHIC_18_BOLD),
                           color);
    prv_draw_centered_text(ctx, GRect(viewport.origin.x + 8, viewport.origin.y + 88,
                                      viewport.size.w - 16, 24),
                           hint, fonts_get_system_font(FONT_KEY_GOTHIC_14_BOLD),
                           GColorLightGray);
  }

  char status[40];
  if (s_waiting_for_frame) {
    snprintf(status, sizeof(status), "REFRESHING...");
  } else if (s_status == APP_STATUS_ERROR) {
    strncpy(status, prv_error_hint(), sizeof(status) - 1);
    status[sizeof(status) - 1] = '\0';
  } else if (s_status == APP_STATUS_READY) {
    prv_format_updated(status, sizeof(status));
  } else {
    snprintf(status, sizeof(status), "SELECT REFRESH | UP/DOWN CAMERAS");
  }
  graphics_context_set_fill_color(ctx, GColorWhite);
  graphics_fill_rect(ctx, footer, 0, GCornerNone);
  graphics_context_set_stroke_color(ctx, GColorBlack);
  graphics_draw_line(ctx, GPoint(0, footer.origin.y), GPoint(bounds.size.w, footer.origin.y));
  prv_draw_centered_text(ctx, GRect(4, footer.origin.y + 5, bounds.size.w - 8, 22),
                         status, fonts_get_system_font(FONT_KEY_GOTHIC_14_BOLD),
                         GColorBlack);
}

static void prv_copy_frame_to_bitmap(void) {
  if (!s_bitmap || !s_frame) {
    return;
  }

  uint8_t *bitmap_data = gbitmap_get_data(s_bitmap);
  uint16_t row_bytes = gbitmap_get_bytes_per_row(s_bitmap);
  for (int y = 0; y < s_frame_h; y++) {
    memcpy(bitmap_data + y * row_bytes, s_frame + y * s_frame_w, s_frame_w);
  }
}

static void prv_begin_frame(uint32_t seq, int w, int h, uint32_t total) {
  if (seq != s_active_frame_seq || w <= 0 || h <= 0 ||
      w > VIEW_W || h > VIEW_H || total != (uint32_t)(w * h)) {
    return;
  }

  prv_free_frame();
  s_frame = malloc(total);
  s_bitmap = gbitmap_create_blank(GSize(w, h), GBitmapFormat8Bit);
  if (!s_frame || !s_bitmap) {
    prv_free_frame();
    prv_set_error("NO MEMORY");
    return;
  }

  memset(s_frame, 0xC0, total);
  s_frame_len = total;
  s_frame_received = 0;
  s_frame_w = w;
  s_frame_h = h;
  s_status = APP_STATUS_LOADING;
  s_waiting_for_frame = true;
  prv_mark_dirty();
}

static void prv_receive_chunk(uint32_t seq, uint32_t offset, uint8_t *data,
                              uint32_t len) {
  if (seq != s_active_frame_seq || !s_frame || offset >= s_frame_len) {
    return;
  }
  if (offset + len > s_frame_len) {
    len = s_frame_len - offset;
  }

  memcpy(s_frame + offset, data, len);
  if (offset + len > s_frame_received) {
    s_frame_received = offset + len;
  }
}

static void prv_complete_frame(uint32_t seq) {
  if (seq != s_active_frame_seq || !s_frame || s_frame_received < s_frame_len) {
    return;
  }

  prv_cancel_request_timeout();
  prv_copy_frame_to_bitmap();
  s_last_updated = (uint32_t)time(NULL);
  s_status = APP_STATUS_READY;
  s_waiting_for_frame = false;
  prv_hold_backlight();
  prv_schedule_status_redraw();
  prv_mark_dirty();
}

static void prv_inbox_received(DictionaryIterator *iter, void *context) {
  (void)context;
  Tuple *t;
  bool got_config = false;
  bool got_camera_index = false;

  if ((t = dict_find(iter, MESSAGE_KEY_CameraCount))) {
    got_config = true;
    s_camera_count = (int)t->value->int32;
    if (s_camera_count < 0) {
      s_camera_count = 0;
    }
    if (s_camera_count > 0 && s_camera_index >= s_camera_count) {
      s_camera_index = 0;
      persist_write_int(PERSIST_SELECTED_CAMERA, s_camera_index);
    }
  }

  if ((t = dict_find(iter, MESSAGE_KEY_CameraIndex))) {
    got_camera_index = true;
    int idx = (int)t->value->int32;
    if (idx >= 0) {
      s_camera_index = idx;
    }
  }

  if ((t = dict_find(iter, MESSAGE_KEY_CameraName))) {
    got_config = true;
    strncpy(s_camera_name, t->value->cstring, sizeof(s_camera_name) - 1);
    s_camera_name[sizeof(s_camera_name) - 1] = '\0';
  }

  uint32_t seq = s_active_frame_seq;
  if ((t = dict_find(iter, MESSAGE_KEY_FrameSeq))) {
    seq = (uint32_t)t->value->uint32;
  }

  if ((t = dict_find(iter, MESSAGE_KEY_ErrorCode))) {
    (void)t;
    Tuple *msg = dict_find(iter, MESSAGE_KEY_ErrorMessage);
    prv_set_error(msg ? msg->value->cstring : "ERROR");
    return;
  }

  if (got_config && !got_camera_index) {
    prv_request_frame();
    return;
  }

  Tuple *width = dict_find(iter, MESSAGE_KEY_FrameWidth);
  Tuple *height = dict_find(iter, MESSAGE_KEY_FrameHeight);
  Tuple *total = dict_find(iter, MESSAGE_KEY_FrameTotalBytes);
  if (width && height && total) {
    prv_begin_frame(seq, (int)width->value->int32,
                    (int)height->value->int32,
                    (uint32_t)total->value->uint32);
  }

  Tuple *offset = dict_find(iter, MESSAGE_KEY_FrameOffset);
  Tuple *chunk = dict_find(iter, MESSAGE_KEY_FrameChunk);
  Tuple *chunk_size = dict_find(iter, MESSAGE_KEY_FrameChunkSize);
  if (offset && chunk) {
    uint32_t len = chunk_size ? (uint32_t)chunk_size->value->uint32
                              : (uint32_t)chunk->length;
    prv_receive_chunk(seq, (uint32_t)offset->value->uint32,
                      chunk->value->data, len);
  }

  if ((t = dict_find(iter, MESSAGE_KEY_FrameComplete))) {
    (void)t;
    prv_complete_frame(seq);
  }

  prv_mark_dirty();
}

static void prv_inbox_dropped(AppMessageResult reason, void *context) {
  (void)context;
  APP_LOG(APP_LOG_LEVEL_WARNING, "Inbox dropped: %d", (int)reason);
}

static void prv_outbox_failed(DictionaryIterator *iter, AppMessageResult reason,
                              void *context) {
  (void)iter;
  (void)context;
  APP_LOG(APP_LOG_LEVEL_WARNING, "Outbox failed: %d", (int)reason);
  prv_set_error("SEND FAILED");
}

static void prv_select_click(ClickRecognizerRef r, void *ctx) {
  (void)r;
  (void)ctx;
  prv_request_frame();
}

static void prv_up_click(ClickRecognizerRef r, void *ctx) {
  (void)r;
  (void)ctx;
  prv_select_camera(-1);
}

static void prv_down_click(ClickRecognizerRef r, void *ctx) {
  (void)r;
  (void)ctx;
  prv_select_camera(1);
}

static void prv_click_config_provider(void *context) {
  (void)context;
  window_single_click_subscribe(BUTTON_ID_SELECT, prv_select_click);
  window_single_click_subscribe(BUTTON_ID_UP, prv_up_click);
  window_single_click_subscribe(BUTTON_ID_DOWN, prv_down_click);
}

static void prv_initial_request(void *context) {
  (void)context;
  prv_request_frame();
}

static void prv_window_load(Window *window) {
  Layer *root = window_get_root_layer(window);
  s_layer = layer_create(layer_get_bounds(root));
  layer_set_update_proc(s_layer, prv_layer_update);
  layer_add_child(root, s_layer);
}

static void prv_window_unload(Window *window) {
  (void)window;
  if (s_layer) {
    layer_destroy(s_layer);
    s_layer = NULL;
  }
}

static void prv_init(void) {
  s_camera_index = persist_exists(PERSIST_SELECTED_CAMERA)
                 ? persist_read_int(PERSIST_SELECTED_CAMERA)
                 : 0;
  if (s_camera_index < 0) {
    s_camera_index = 0;
  }
  s_status = APP_STATUS_EMPTY;
  strncpy(s_camera_name, "PinHole", sizeof(s_camera_name) - 1);

  app_message_register_inbox_received(prv_inbox_received);
  app_message_register_inbox_dropped(prv_inbox_dropped);
  app_message_register_outbox_failed(prv_outbox_failed);
  app_message_open(2048, 128);

  s_window = window_create();
  window_set_background_color(s_window, GColorBlack);
  window_set_click_config_provider(s_window, prv_click_config_provider);
  window_set_window_handlers(s_window, (WindowHandlers) {
    .load = prv_window_load,
    .unload = prv_window_unload,
  });
  window_stack_push(s_window, true);

  app_timer_register(750, prv_initial_request, NULL);
}

static void prv_deinit(void) {
  prv_cancel_request_timeout();
  prv_cancel_status_redraw();
  if (s_backlight_timer) {
    app_timer_cancel(s_backlight_timer);
    s_backlight_timer = NULL;
  }
  light_enable(false);
  prv_free_frame();
  app_message_deregister_callbacks();
  if (s_window) {
    window_destroy(s_window);
    s_window = NULL;
  }
}

int main(void) {
  prv_init();
  app_event_loop();
  prv_deinit();
}
