/* Native Rancher/Ember routes. Templates use the shipped Rancher components. */
define('ui/initializers/local-rbac-routes', ['exports','ember'], function(exports, ember) {
  'use strict';
  var E=ember.default;
  function api(path,body) {
    var csrf=document.cookie.split('; ').find(function(c){return c.indexOf('CSRF=')===0;});
    return E.RSVP.resolve(fetch('/v2-beta/'+path,{credentials:'same-origin',method:body?'POST':'GET',headers:{'Accept':'application/json','Content-Type':'application/json','X-Api-Csrf':csrf?decodeURIComponent(csrf.substring(5)):''},body:body?JSON.stringify(body):undefined})).then(function(response){
      return response.json().then(function(data){if(!response.ok){throw new Error(data.message||data.code||'Falha ao carregar os dados.');}return data;});
    });
  }
  function id(value){return String(value).replace(/^1a/,'');}
  var NativeRoute=E.Route.extend({
    access:E.inject.service(),projects:E.inject.service(),
    beforeModel:function(){
      var route=this;
      return E.RSVP.resolve(window.RANCHER_CUSTOMIZATION_READY).then(function(config){
        var required=route.get('routeName')==='local-groups'?'LOCAL_RBAC_ENABLED':'NO_ACCESS_VIEW_ENABLED';
        if(!config.effective[required]){window.location.replace('/');return E.RSVP.reject('Feature disabled');}
        return api('token');
      }).then(function(response){
        var token=response.data[0];
        if(!token.userIdentity){E.getOwner(route).lookup('service:session').set('backTo','/'+route.get('routeName'));route.replaceWith('login');return E.RSVP.reject('Login required');}
        route.set('access.admin',token.userType==='admin');
        if(route.get('routeName')==='local-groups' && token.userType!=='admin'){route.replaceWith('no-access');return E.RSVP.reject('Admin required');}
        var auth=E.getOwner(route).lookup('route:authenticated');
        return auth.loadUserSchemas().then(function(){return auth.loadPreferences();});
      });
    }
  });
  exports.default={name:'local-rbac-routes',initialize:function(application){
    require('ui/utils/additional-routes').addRoutes(function(){this.route('no-access');this.route('local-groups');});
    application.register('template:no-access',E.HTMLBars.template(LOCAL_RBAC_TEMPLATES.noAccess),{instantiate:false});
    application.register('template:local-groups',E.HTMLBars.template(LOCAL_RBAC_TEMPLATES.localGroups),{instantiate:false});
    application.register('route:no-access',NativeRoute.extend({
      model:function(){var route=this;return this.get('projects').getAll().then(function(projects){route.set('projects.all',projects);route.get('projects').setCurrent(null);if(projects.get('length')){route.replaceWith('authenticated');}return {};});}
    }));
    application.register('controller:no-access',E.Controller.extend({
      projects:E.inject.service(),checking:false,message:null,
      actions:{checkAccess:function(){var controller=this;this.setProperties({checking:true,message:null});return this.get('projects').getAll().then(function(projects){controller.set('projects.all',projects);if(projects.get('length')){controller.transitionToRoute('authenticated');}else{controller.set('message','Seu acesso ainda nÃ£o foi liberado.');}}).finally(function(){controller.set('checking',false);});}}
    }));
    application.register('route:local-groups',NativeRoute.extend({
      model:function(){return E.RSVP.hash({groups:api('localGroups').then(function(r){return r.data;}),users:api('accounts?limit=-1').then(function(r){return r.data.filter(function(a){return ['user','admin'].includes(a.kind)&&a.state==='active'&&!a.removed;});}),projects:api('projects?all=true&limit=-1').then(function(r){return r.data.filter(function(p){return !p.removed;});})});},
      setupController:function(controller,model){this._super(controller,model);controller.edit(null);}
    }));
    application.register('controller:local-groups',E.Controller.extend({
      current:null,draftName:'',members:null,environments:null,saving:false,message:null,error:false,
      edit:function(group){
        this.setProperties({current:group,draftName:group?group.name:'',members:this.get('model.users').map(function(user){return E.Object.create({id:id(user.id),displayId:user.id,name:user.name||user.id,selected:!!group&&group.members.includes(id(user.id))});}),environments:this.get('model.projects').map(function(project){return E.Object.create({id:id(project.id),name:project.name,role:group&&group.grants[id(project.id)]||''});})});
      },
      save:function(remove){
        var controller=this;var group=this.get('current');var body={name:this.get('draftName'),members:this.get('members').filterBy('selected',true).mapBy('id'),grants:{}};
        if(!body.name||!body.name.trim()){this.setProperties({message:'Informe o nome do grupo.',error:true});return;}
        this.get('environments').forEach(function(p){if(p.get('role')){body.grants[p.get('id')]=p.get('role');}});
        if(group){body.id=group.id;body.revision=group.revision;}if(remove){body.delete=true;}
        this.setProperties({saving:true,message:null,error:false});
        return api('localGroups',body).then(function(saved){return api('localGroups').then(function(response){controller.set('model.groups',response.data);controller.edit(remove?null:response.data.find(function(g){return g.id===saved.id;}));controller.set('message',remove?'Grupo excluÃ­do.':'Grupo salvo. As permissÃµes foram atualizadas.');});}).catch(function(error){controller.setProperties({message:error.message,error:true});}).finally(function(){controller.set('saving',false);});
      },
      actions:{newGroup:function(){this.edit(null);},editGroup:function(group){this.edit(group);},setRole:function(project,role){project.set('role',role);},saveGroup:function(){return this.save(false);},deleteGroup:function(){if(window.confirm('Excluir este grupo e retirar os acessos concedidos por ele?')){return this.save(true);}}}
    }));
    require('ui/components/page-header/component').default.reopen({
      updateNavTree:function(){this._super.apply(this,arguments);if(window.RANCHER_CUSTOMIZATION && window.RANCHER_CUSTOMIZATION.effective.LOCAL_RBAC_ENABLED && this.get('access.admin')){this.get('navTree').pushObject({id:'local-groups',label:'Grupos',url:'/local-groups',submenu:[]});}}
    });
  }};
});
