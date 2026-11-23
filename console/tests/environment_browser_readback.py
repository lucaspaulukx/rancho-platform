"""Environment readback; --templates exercises disposable native browser workflows."""
import copy
import importlib.util
import json
import logging
import secrets
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('lab',ROOT/'tests/integration.py')
lab=importlib.util.module_from_spec(spec)
spec.loader.exec_module(lab)
lab.BASE='http://localhost:18090'
checks=[]
def check(name,condition):
    assert condition,name
    checks.append({'check':name,'status':'passed'})
    print('PASS: '+name,flush=True)

def seed_template_answers(admin,value):
    assert str(value.get('name','')).startswith('console-template-')
    assert str(value.get('description','')).startswith('Synthetic environment-template browser fixture ')
    stacks=copy.deepcopy(value['stacks'])
    answers={'fixture_string':'synthetic-template-answer','fixture_number':3,'fixture_boolean':True}
    stacks[-1]['answers']=answers
    admin.api('projecttemplates/'+value['id'],{'stacks':stacks},method='PUT')
    deadline=time.monotonic()+45
    while time.monotonic()<deadline:
        current=admin.api('projecttemplates/'+value['id'])
        if current.get('state')=='active' and current['stacks'][-1].get('answers')==answers:
            return current
        time.sleep(.3)
    raise AssertionError('Typed-answer fixture did not stabilize')

def template_audit(page,label):
        source=(ROOT/'console/node_modules/axe-core/axe.min.js').read_text(encoding='utf-8')
        page.evaluate(source)
        violations=page.evaluate('''async () => {
            await document.fonts.ready;
            await Promise.all(document.getAnimations().filter(animation =>
                Number.isFinite(animation.effect?.getComputedTiming().endTime))
                .map(animation => animation.finished.catch(() => {})));
            const result = await axe.run(document, {runOnly: {type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa']}});
            return result.violations.map(value => ({id: value.id, impact: value.impact}));
        }''')
        checks.append({'check':label,'status':'failed' if violations else 'passed','sourceStyles':False,'violations':violations})
        print(('FAILED: ' if violations else 'PASS: ')+label,flush=True)
        assert not violations

def template_browser_acceptance():
    from playwright.sync_api import expect, sync_playwright
    logging.disable(logging.CRITICAL)
    admin=lab.Session()
    admin.opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPCookieProcessor(admin.cookies))
    prefix='console-template-'+secrets.token_hex(5)
    marker='Synthetic environment-template browser fixture '+prefix
    names=[prefix,prefix+'-copy']
    project_name=prefix+'-environment'
    stage='template browser initialization'
    def find(collection,name):
        return next((value for value in admin.api(collection+'?name='+urllib.parse.quote(name)+'&limit=100')['data'] if value.get('name')==name and not value.get('removed')),None)
    def native(value,resource=False):
        if resource:
            schema=admin.api('schemas/project')
            assert 'DELETE' in schema.get('resourceMethods',[])
            href=value.get('links',{}).get('self')
        else:
            href=value.get('actions',{}).get('remove')
        assert href
        parsed=urllib.parse.urlparse(href)
        assert parsed.path.startswith('/v2-beta/')
        path=parsed.path+('?' + parsed.query if parsed.query else '')
        status,_,_=admin.request(path,None if resource else {},method='DELETE' if resource else 'POST')
        assert status in (200,201,202,204)
    def removed(collection,identifier):
        deadline=time.monotonic()+90
        while time.monotonic()<deadline:
            status,value,_=admin.request('/v2-beta/'+collection+'/'+identifier)
            if status==404 or status==200 and (value.get('removed') or value.get('state')=='removed'):
                return True
            time.sleep(.3)
        return False
    try:
        admin.login('labadmin',lab.CONFIG['RANCHER_ADMIN_PASSWORD'])
        source=find('projecttemplates','Cattle')
        assert source and source.get('stacks')
        with sync_playwright() as playwright:
            browser=playwright.chromium.launch(headless=True)
            context=browser.new_context(viewport={'width':1440,'height':1000})
            context.add_cookies([{'name':item.name,'value':item.value,'url':lab.BASE} for item in admin.cookies if item.name in ('token','CSRF')])
            page=context.new_page()
            errors=[]
            page.on('pageerror',lambda _: errors.append('browser error'))
            page.goto(lab.BASE+'/console/environments?env=1a12')
            page.get_by_role('button',name='Templates',exact=True).click()
            manager=page.get_by_role('dialog',name='Templates de environment',exact=True)
            manager.get_by_label('Buscar registros',exact=True).fill('Cattle')
            manager.get_by_role('button',name='Copiar template Cattle',exact=True).click()
            stage='native template clone and inline Compose'
            editor=page.get_by_role('dialog',name='Novo template de environment',exact=True)
            editor.get_by_label('Nome do template *',exact=True).fill(names[0])
            editor.get_by_label('Descricao do template',exact=True).fill(marker)
            expect(editor.get_by_label('Visibilidade do template',exact=True)).not_to_be_checked()
            editor.get_by_role('button',name='Adicionar stack Compose',exact=True).click()
            position=len(source['stacks'])+1
            editor.get_by_label('Nome da stack '+str(position),exact=True).fill('fixture-compose')
            compose='version: "2"\nservices:\n  fixture:\n    image: busybox:1.36.1\n'
            rancher_compose='version: "2"\nservices:\n  fixture:\n    scale: 0\n'
            editor.get_by_label('Docker Compose da stack '+str(position),exact=True).fill(compose)
            editor.get_by_label('Rancher Compose da stack '+str(position),exact=True).fill(rancher_compose)
            template_audit(page,'WCAG automated native template editor desktop dark')
            editor.get_by_role('button',name='Salvar template',exact=True).click()
            expect(editor).not_to_be_visible(timeout=30000)
            created=find('projecttemplates',names[0])
            check('browser clones a private template preserving all native stacks and answers',created and created.get('isPublic') is False and created['stacks'][:-1]==source['stacks'])
            check('browser persists both native Compose files without starting workloads',created['stacks'][-1].get('dockerCompose')==compose and created['stacks'][-1].get('rancherCompose')==rancher_compose)
            created=seed_template_answers(admin,created)
            stage='native template editing'
            manager.get_by_label('Buscar registros',exact=True).fill(names[0])
            manager.get_by_role('button',name='Abrir template '+names[0],exact=True).click()
            editor=page.get_by_role('dialog',name='Template · '+names[0],exact=True)
            editor.get_by_label('Descricao do template',exact=True).fill(marker+' updated')
            editor.get_by_role('button',name='Salvar template',exact=True).click()
            expect(editor).not_to_be_visible(timeout=30000)
            updated=find('projecttemplates',names[0])
            check('metadata editing preserves bindings answers and Compose on the server',updated.get('description')==marker+' updated' and updated['stacks']==created['stacks'])
            stage='private template authorization'
            reader=lab.Session()
            reader.opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPCookieProcessor(reader.cookies))
            reader.oidc('leitor')
            status,_,_=reader.request('/v2-beta/projecttemplates/'+created['id'])
            check('native authorization hides the private template from another account',status in (403,404) and created['id'] not in {value['id'] for value in reader.api('projecttemplates')['data']})
            stage='template mobile layout'
            manager.get_by_role('button',name='Copiar template '+names[0],exact=True).click()
            editor=page.get_by_role('dialog',name='Novo template de environment',exact=True)
            editor.get_by_label('Nome do template *',exact=True).fill(names[1])
            page.set_viewport_size({'width':390,'height':844})
            expect(editor.get_by_label('Nome do template *',exact=True)).to_be_visible()
            check('template editor fits mobile viewport without horizontal overflow',editor.evaluate('(element) => element.scrollWidth <= element.clientWidth + 1'))
            template_audit(page,'WCAG automated native template editor mobile dark')
            page.screenshot(path=str(ROOT/'evidence/console-environment-template-mobile.png'))
            editor.get_by_role('button',name='Salvar template',exact=True).click()
            expect(editor).not_to_be_visible(timeout=30000)
            copy=find('projecttemplates',names[1])
            check('copying a custom template retains all native fields and remains private',copy and copy['stacks']==updated['stacks'] and copy.get('isPublic') is False)
            page.set_viewport_size({'width':1440,'height':1000})
            manager.get_by_label('Buscar registros',exact=True).fill(names[1])
            manager.get_by_role('button',name='Remover template '+names[1],exact=True).click()
            page.get_by_role('button',name='Confirmar',exact=True).click()
            check('browser removes only the disposable copy through the native action',removed('projecttemplates',copy['id']))
            manager.get_by_role('button',name='Fechar',exact=True).click()
            page.get_by_role('button',name='Usar tema claro',exact=True).click()
            page.get_by_role('button',name='Templates',exact=True).click()
            manager.get_by_label('Buscar registros',exact=True).fill(names[0])
            manager.get_by_role('button',name='Abrir template '+names[0],exact=True).click()
            editor=page.get_by_role('dialog',name='Template · '+names[0],exact=True)
            expect(editor.get_by_label('Nome do template *',exact=True)).to_be_visible()
            template_audit(page,'WCAG automated native template editor desktop light')
            page.screenshot(path=str(ROOT/'evidence/console-environment-template-light.png'))
            editor.get_by_role('button',name='Cancelar',exact=True).click()
            manager.get_by_role('button',name='Fechar',exact=True).click()
            stage='environment creation from browser-managed template'
            page.get_by_role('button',name='Criar environment',exact=True).click()
            page.get_by_label('Nome *',exact=True).fill(project_name)
            page.get_by_label('Descrição',exact=True).fill(marker)
            page.get_by_label('Template do environment',exact=True).select_option(created['id'])
            page.get_by_role('button',name='Salvar',exact=True).click()
            expect(page.get_by_role('heading',name=project_name,exact=True)).to_be_visible(timeout=45000)
            project=find('projects',project_name)
            assert project and project.get('description')==marker
            deadline=time.monotonic()+90
            stacks=[]
            while time.monotonic()<deadline:
                stacks=admin.api('projects/'+project['id']+'/stacks')['data']
                if len(stacks)>=len(updated['stacks']): break
                time.sleep(.3)
            check('browser-managed template provisions native stacks in its isolated environment',project.get('projectTemplateId')==created['id'] and {value.get('name') for value in updated['stacks']}.issubset({value.get('name') for value in stacks}) and all(value.get('accountId')==project['id'] for value in stacks))
            check('template acceptance has no host container or browser exception',not admin.api('projects/'+project['id']+'/hosts')['data'] and not admin.api('projects/'+project['id']+'/containers')['data'] and not errors)
            browser.close()
    except Exception as error:
        checks.append({'check':stage,'status':'failed','errorType':type(error).__name__})
        print('FAILED: '+stage+'; sensitive output withheld.',flush=True)
    finally:
        try:
            project=find('projects',project_name)
            if project:
                assert project.get('description')==marker
                native(project,resource=True)
                assert removed('projects',project['id'])
            for name in reversed(names):
                value=find('projecttemplates',name)
                if value:
                    assert str(value.get('description','')).startswith(marker)
                    native(value)
                    assert removed('projecttemplates',value['id'])
            check('disposable environment and templates are removed without touching native defaults',find('projects',project_name) is None and all(find('projecttemplates',name) is None for name in names) and find('projecttemplates','Cattle') is not None)
        except Exception as error:
            checks.append({'check':'template browser cleanup','status':'failed','errorType':type(error).__name__})
            print('FAILED: template browser cleanup; sensitive output withheld.',flush=True)
        (ROOT/'console/environment-template-browser-test-results.json').write_text(json.dumps(checks,indent=2)+'\n',encoding='utf-8')
    return 1 if any(value['status']!='passed' for value in checks) else 0

if '--templates' in sys.argv:
    raise SystemExit(template_browser_acceptance())

try:
    admin=lab.Session()
    admin.opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPCookieProcessor(admin.cookies))
    admin.login('labadmin',lab.CONFIG['RANCHER_ADMIN_PASSWORD'])
    template=next(item for item in admin.api('projecttemplates')['data'] if item.get('name')=='Cattle' and not item.get('removed'))
    project=next(item for item in admin.api('projects')['data'] if item.get('name')=='CONSOLE-TEMPLATE-UI' and not item.get('removed'))
    check('browser environment preserves its selected template and metadata',project.get('state')=='active' and project.get('description')=='Synthetic environment browser fixture' and project.get('projectTemplateId')==template['id'])
    stacks=admin.api('projects/'+project['id']+'/stacks')['data']
    check('browser environment provisions native infrastructure definitions in its own scope',{item['name'] for item in template['stacks']}.issubset({item.get('name') for item in stacks}) and all(item['accountId']==project['id'] for item in stacks))
except Exception as error:
    checks.append({'check':'browser environment persistence','status':'failed','errorType':type(error).__name__})
    print('FAILED: browser environment persistence; sensitive output withheld.',flush=True)
finally:
    (ROOT/'console/environment-browser-test-results.json').write_text(json.dumps(checks,indent=2)+'\n',encoding='utf-8')
if any(item['status']!='passed' for item in checks):raise SystemExit(1)
