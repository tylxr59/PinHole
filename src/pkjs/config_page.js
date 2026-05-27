'use strict';

function htmlEscape(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function scriptJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function page(settings, returnTo) {
  var cacheOptions = ['0', '5', '10', '15', '30', '60'].map(function(v) {
    return '<option value="' + v + '"' +
      (String(settings.cacheSeconds) === v ? ' selected' : '') +
      '>' + v + ' seconds</option>';
  }).join('');

  return '<!doctype html>' +
    '<html><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>PinHole Settings</title>' +
    '<style>' +
    'body{margin:0;background:#111;color:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;font-size:16px;}' +
    'main{max-width:720px;margin:0 auto;padding:18px 14px 28px;}' +
    'h1{font-size:24px;margin:0 0 4px;}h2{font-size:18px;margin:24px 0 10px;}' +
    'p{color:#bbb;line-height:1.35;margin:0 0 14px;}' +
    'label{display:block;font-weight:700;margin:14px 0 6px;}' +
    'input,select{box-sizing:border-box;width:100%;background:#252525;color:#fff;border:1px solid #444;border-radius:6px;padding:10px;font:inherit;}' +
    '.camera{border:1px solid #333;background:#1b1b1b;border-radius:8px;padding:12px;margin:10px 0;}' +
    '.camera-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:4px;}' +
    '.camera-title{font-weight:700;color:#ddd;}.camera-tools{display:flex;gap:8px;}' +
    '.row{display:grid;grid-template-columns:1fr;gap:0;}' +
    '.actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:18px;}' +
    'button,a.button{border:0;border-radius:6px;padding:10px 12px;font:inherit;font-weight:700;text-align:center;text-decoration:none;}' +
    'button{background:#ff4700;color:#fff;}.secondary{background:#333;color:#fff;}.danger{background:#3a2020;color:#ffb0a0;}' +
    '.actions button{flex:1;}.empty{border:1px dashed #444;border-radius:8px;padding:18px;text-align:center;color:#aaa;margin:10px 0;}' +
    '.hint{font-size:13px;color:#999;margin-top:6px;}.error{color:#ffb0a0;margin-top:10px;font-weight:700;}' +
    '.result{font-size:13px;color:#aaa;margin-top:10px;}.result.ok{color:#9ee7a2}.result.bad{color:#ffb0a0}' +
    '.preview{display:block;max-width:200px;width:100%;height:auto;border:1px solid #444;border-radius:6px;margin-top:8px;background:#000;}' +
    '.summary{font-size:14px;color:#bbb;margin-top:10px;}' +
    '.modal{position:fixed;left:0;right:0;top:0;bottom:0;background:rgba(0,0,0,.86);display:none;align-items:center;justify-content:center;padding:18px;z-index:10;}' +
    '.modal.open{display:flex}.modal img{max-width:100%;max-height:86vh;background:#000;border:1px solid #555}.modal button{position:fixed;right:14px;top:14px;}' +
    '@media(min-width:620px){.row{grid-template-columns:1fr 1fr;gap:12px}.actions button{flex:0 0 auto}}' +
    '</style></head><body><main>' +
    '<h1>PinHole Settings</h1>' +
    '<p>Configure go2rtc snapshots for your Pebble Time 2.</p>' +
    '<form id="form">' +
    '<h2>go2rtc</h2>' +
    '<label for="baseUrl">Base URL</label>' +
    '<input id="baseUrl" type="url" placeholder="http://host:1984" value="' + htmlEscape(settings.baseUrl) + '">' +
    '<div class="hint">URL reachable from the paired phone.</div>' +
    '<label for="cacheSeconds">Cache seconds</label>' +
    '<select id="cacheSeconds">' + cacheOptions + '</select>' +
    '<h2>Cameras</h2>' +
    '<p>Add any number of go2rtc stream aliases. Test a camera to preview the snapshot from this phone.</p>' +
    '<div id="cameras"></div>' +
    '<button type="button" class="secondary" id="add">Add Camera</button>' +
    '<div id="summary" class="summary"></div>' +
    '<div id="error" class="error"></div>' +
    '<div class="actions">' +
    '<button type="button" class="secondary" id="validate">Validate All</button>' +
    '<button type="submit">Save</button>' +
    '<a class="button secondary" href="' + htmlEscape(returnTo) + '">Cancel</a>' +
    '</div>' +
    '</form>' +
    '</main>' +
    '<div id="modal" class="modal"><button type="button" id="closeModal">Close</button><img id="modalImg"></div>' +
    '<script>' + script(settings, returnTo) + '</script></body></html>';
}

function script(settings, returnTo) {
  return '(function(){' +
    'var returnTo=' + scriptJson(returnTo) + ';' +
    'var cameras=' + scriptJson(settings.cameras || []) + ';' +
    'var results=[];' +
    'var list=document.getElementById("cameras");' +
    'var error=document.getElementById("error");' +
    'var summary=document.getElementById("summary");' +
    'var baseUrl=document.getElementById("baseUrl");' +
    'var cacheSeconds=document.getElementById("cacheSeconds");' +
    'var modal=document.getElementById("modal");' +
    'var modalImg=document.getElementById("modalImg");' +
    'function esc(s){return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}' +
    'function trim(s){return String(s||"").replace(/^\\s+|\\s+$/g,"");}' +
    'function normalize(url){url=trim(url);while(url.length>1&&url.charAt(url.length-1)==="/"){url=url.substring(0,url.length-1);}return url;}' +
    'function snapshotUrl(stream){var url=normalize(baseUrl.value)+"/api/frame.jpeg?src="+encodeURIComponent(stream)+"&w=200";var cache=parseInt(cacheSeconds.value||"0",10)||0;if(cache>0){url+="&cache="+encodeURIComponent(cache+"s");}url+="&_pinhole_test="+Date.now();return url;}' +
    'function setResult(i,state,message,url){results[i]={state:state,message:message,url:url||""};renderResult(i);}' +
    'function resultHtml(i){var r=results[i];if(!r){return "";}var cls=r.state==="ok"?" ok":r.state==="bad"?" bad":"";var html="<div class=\\"result"+cls+"\\">"+esc(r.message)+"</div>";if(r.state==="ok"&&r.url){html+="<img class=\\"preview\\" data-preview=\\""+i+"\\" src=\\""+esc(r.url)+"\\" alt=\\"Camera preview\\">";}return html;}' +
    'function renderResult(i){var box=document.querySelector("[data-result=\\""+i+"\\"]");if(box){box.innerHTML=resultHtml(i);}}' +
    'function render(){list.innerHTML="";if(!cameras.length){list.innerHTML="<div class=\\"empty\\">No cameras yet.</div>";}' +
    'for(var i=0;i<cameras.length;i++){var c=cameras[i]||{};var div=document.createElement("div");div.className="camera";' +
    'div.innerHTML="<div class=\\"camera-head\\"><div class=\\"camera-title\\">Camera "+(i+1)+"</div><div class=\\"camera-tools\\"><button type=\\"button\\" class=\\"secondary\\" data-test=\\""+i+"\\">Test</button><button type=\\"button\\" class=\\"danger\\" data-remove=\\""+i+"\\">Remove</button></div></div>"+' +
    '"<div class=\\"row\\"><div><label>Name</label><input data-name=\\""+i+"\\" value=\\""+esc(c.name)+"\\" placeholder=\\"Front Door\\"></div>"+' +
    '"<div><label>go2rtc stream</label><input data-stream=\\""+i+"\\" value=\\""+esc(c.stream)+"\\" placeholder=\\"front\\"></div></div><div data-result=\\""+i+"\\">"+resultHtml(i)+"</div>";list.appendChild(div);}}' +
    'function sync(){var n=list.querySelectorAll("[data-name]");for(var i=0;i<n.length;i++){var idx=parseInt(n[i].getAttribute("data-name"),10);cameras[idx].name=n[i].value;}var s=list.querySelectorAll("[data-stream]");for(i=0;i<s.length;i++){idx=parseInt(s[i].getAttribute("data-stream"),10);cameras[idx].stream=s[i].value;}}' +
    'function cameraValid(i){sync();var base=normalize(baseUrl.value);var c=cameras[i]||{};var name=trim(c.name);var stream=trim(c.stream);if(!base){setResult(i,"bad","Set the base URL first.");return false;}if(!name||!stream){setResult(i,"bad","Enter both a name and stream.");return false;}return true;}' +
    'function testCamera(i,done){if(!cameraValid(i)){if(done){done(false);}return;}var stream=trim(cameras[i].stream);var url=snapshotUrl(stream);var img=new Image();var finished=false;var timer=setTimeout(function(){finish(false,"Timeout loading snapshot.");},15000);function finish(ok,msg){if(finished){return;}finished=true;clearTimeout(timer);setResult(i,ok?"ok":"bad",msg,url);if(done){done(ok);}}img.onload=function(){finish(true,"Loaded preview.");};img.onerror=function(){finish(false,"Could not load snapshot.");};setResult(i,"loading","Loading preview...");img.src=url;}' +
    'document.getElementById("add").onclick=function(){sync();cameras.push({name:"",stream:""});results.push(null);summary.innerHTML="";render();};' +
    'document.getElementById("validate").onclick=function(){sync();summary.innerHTML="Validating cameras...";error.innerHTML="";var total=cameras.length;if(!total){summary.innerHTML="Add at least one camera to validate.";return;}var i=0;var pass=0;function next(){if(i>=total){summary.innerHTML=pass+" of "+total+" cameras loaded.";return;}testCamera(i,function(ok){if(ok){pass++;}i++;next();});}next();};' +
    'list.onclick=function(e){var t=e.target;if(!t){return;}if(t.getAttribute("data-remove")!==null){sync();var idx=parseInt(t.getAttribute("data-remove"),10);cameras.splice(idx,1);results.splice(idx,1);summary.innerHTML="";render();return;}if(t.getAttribute("data-test")!==null){summary.innerHTML="";error.innerHTML="";testCamera(parseInt(t.getAttribute("data-test"),10));return;}if(t.getAttribute("data-preview")!==null){var r=results[parseInt(t.getAttribute("data-preview"),10)];if(r&&r.url){modalImg.src=r.url;modal.className="modal open";}}};' +
    'list.oninput=function(e){var t=e.target;if(t&&t.getAttribute("data-name")!==null){results[parseInt(t.getAttribute("data-name"),10)]=null;summary.innerHTML="";renderResult(parseInt(t.getAttribute("data-name"),10));}if(t&&t.getAttribute("data-stream")!==null){results[parseInt(t.getAttribute("data-stream"),10)]=null;summary.innerHTML="";renderResult(parseInt(t.getAttribute("data-stream"),10));}};' +
    'baseUrl.oninput=function(){results=[];summary.innerHTML="";render();};cacheSeconds.onchange=function(){results=[];summary.innerHTML="";render();};' +
    'document.getElementById("closeModal").onclick=function(){modal.className="modal";modalImg.src="";};' +
    'modal.onclick=function(e){if(e.target===modal){modal.className="modal";modalImg.src="";}};' +
    'document.getElementById("form").onsubmit=function(e){e.preventDefault();sync();var clean=[];for(var i=0;i<cameras.length;i++){var name=trim(cameras[i].name);var stream=trim(cameras[i].stream);if(!name&&!stream){continue;}if(!name||!stream){error.innerHTML="Each camera needs both a name and a stream.";return;}clean.push({name:name,stream:stream});}' +
    'var payload={BaseUrl:{value:baseUrl.value},CacheSeconds:{value:cacheSeconds.value},CameraList:{value:JSON.stringify(clean)}};' +
    'document.location=returnTo+encodeURIComponent(JSON.stringify(payload));};' +
    'render();' +
    '}());';
}

exports.generateConfigUrl = function(settings) {
  var returnTo = 'pebblejs://close#';
  if (typeof Pebble !== 'undefined' && Pebble.platform === 'pypkjs') {
    returnTo = '$$$RETURN_TO$$$';
  }
  return 'data:text/html;charset=utf-8,' +
    encodeURIComponent(page(settings || {}, returnTo));
};
