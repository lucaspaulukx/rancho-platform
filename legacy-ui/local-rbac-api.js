'use strict';
function csrf() {
  var c=document.cookie.split('; ').find(function (x) { return x.indexOf('CSRF=')===0; });
  return c?decodeURIComponent(c.substring(5)):'';
}
async function api(path,body,method) {
  var response=await fetch('/v2-beta/'+path,{method:method||(body?'POST':'GET'),credentials:'same-origin',headers:{'Accept':'application/json','Content-Type':'application/json','X-Api-Csrf':csrf()},body:body?JSON.stringify(body):undefined});
  var data=await response.json();
  if (!response.ok) { throw new Error(data.message||data.code||('HTTP '+response.status)); }
  return data;
}
async function logout() {
  try { await api('token/current',null,'DELETE'); } finally {
    document.cookie='token=; Path=/; Max-Age=0'; window.location.replace('/login');
  }
}
