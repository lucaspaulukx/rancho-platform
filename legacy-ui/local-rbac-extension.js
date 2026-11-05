/* Lab UI extension loaded between the original vendor and application bundles.
 * Source remains separate to avoid rebuilding the obsolete Ember/Bower toolchain.
 */
(function () {
  'use strict';
  var configReady = fetch('/oidc/config').then(function(r){if(!r.ok){throw new Error('Configuration unavailable');}return r.json();}).then(function(c){window.RANCHER_CUSTOMIZATION=c;return c;});
  window.RANCHER_CUSTOMIZATION_READY=configReady;
  var ticket = new URLSearchParams(window.location.search).get('oidc_ticket');
  if (ticket) { window.history.replaceState({}, '', '/login'); }
  define('ui/initializers/local-rbac', ['exports', 'ember'], function (exports, ember) {
    exports.default = {
      name: 'local-rbac',
      initialize: function () {
        var E = ember.default;
        require('ui/authenticated/route').default.reopen({
          beforeModel: function(transition) {
            var route=this;
            var original=this._super.apply(this,arguments);
            return E.RSVP.resolve(original).then(function(){return configReady;}).then(function(config){
              if(!config.effective.NO_ACCESS_VIEW_ENABLED){return;}
              return fetch('/v2-beta/token',{credentials:'same-origin',headers:{Accept:'application/json'}}).then(function(r){if(!r.ok){throw new Error('Session unavailable');}return r.json();}).then(function(response){
                var token=response.data[0];
                if(!token.userIdentity || token.userType==='admin'){return;}
                return fetch('/v2-beta/projects',{credentials:'same-origin',headers:{Accept:'application/json'}}).then(function(r){if(!r.ok){throw new Error('Projects unavailable');}return r.json();}).then(function(projects){
                  if(projects.data.length===0){transition.abort();route.replaceWith('no-access');}
                });
              });
            });
          },
          loadingError: function (error, transition, result) {
            var projects = this.get('projects.all');
            if (window.RANCHER_CUSTOMIZATION && window.RANCHER_CUSTOMIZATION.effective.NO_ACCESS_VIEW_ENABLED && this.get('access.enabled') && !this.get('access.admin') && projects && projects.get('length') === 0) {
              this.replaceWith('no-access');
              return result;
            }
            return this._super(error, transition, result);
          }
        });
        require('ui/logout/route').default.reopen({beforeModel:function(){sessionStorage.setItem('rancher.oidc.stopped','1');return this._super.apply(this,arguments);}});
        require('ui/login/route').default.reopen({
          beforeModel: function () {
            var session = this.get('session');
            var back = session.get('backTo') || '';
            if (back.indexOf('/oidc/') >= 0) { session.set('backTo', undefined); }
            var original = this._super.apply(this, arguments);
            if (!ticket) {
              return E.RSVP.resolve(original).then(function(){return configReady;}).then(function(c){
                if(c.effective.OIDC_AUTO_LOGIN && !sessionStorage.getItem('rancher.oidc.stopped') && !sessionStorage.getItem('rancher.oidc.attempt') && !new URLSearchParams(location.search).has('timedOut')) {
                  sessionStorage.setItem('rancher.oidc.attempt','1');
                  window.location.assign('/oidc/login');
                }
              });
            }
            var route = this;
            var once = ticket; ticket = null;
            return E.RSVP.resolve(original).then(function () {
              return route.get('access').login('oidc-ticket:' + once);
            }).then(function () {
              sessionStorage.removeItem('rancher.oidc.attempt');
              sessionStorage.removeItem('rancher.oidc.stopped');
              session.set('backTo', undefined);
              window.location.replace('/');
            }).catch(function () {
              window.alert('O login expirou ou foi recusado. Inicie o login pelo Keycloak novamente.');
            });
          }
        });
      }
    };
  });
  define('ui/instance-initializers/local-rbac-login', ['exports'], function (exports) {
    exports.default = {
      name: 'local-rbac-login',
      initialize: function () {
        var status=null;
        function update() {
          var section=document.querySelector('.farm-box.login section');
          if(!status || !status.enabled || !section) { return; }
          if(status.only) { section.classList.add('oidc-only'); }
          if(document.getElementById('oidc-login')) { return; }
          var wrapper=document.createElement('div');wrapper.className='text-center r-mt10 r-mb20 oidc-login-wrapper';
          var button=document.createElement('button');button.type='button';button.id='oidc-login';button.className='btn btn-primary';button.textContent='Entrar com Keycloak';
          button.addEventListener('click',function(event){event.preventDefault();event.stopPropagation();sessionStorage.removeItem('rancher.oidc.stopped');sessionStorage.setItem('rancher.oidc.attempt','1');window.location.assign('/oidc/login');});
          wrapper.appendChild(button);section.appendChild(wrapper);
        }
        var style=document.createElement('style');style.textContent='.oidc-only > :not(.oidc-login-wrapper){display:none!important}';document.head.appendChild(style);
        fetch('/oidc/status').then(function(r){return r.json();}).then(function(s){status=s;update();}).catch(function(){});
        new MutationObserver(update).observe(document.body,{childList:true,subtree:true});
      }
    };
  });
}());
