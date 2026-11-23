import io.cattle.platform.iaas.api.auditing.AuditCredentialRedactor;
import io.cattle.platform.iaas.api.auditing.AuditServiceImpl;
import io.cattle.platform.iaas.api.auditing.AuditLogOutPutFilter;
import io.cattle.platform.core.model.tables.records.AuditLogRecord;
import io.github.ibuildthecloud.gdapi.model.impl.ResourceImpl;
import io.cattle.platform.json.JacksonJsonMapper;
import io.github.ibuildthecloud.gdapi.json.JacksonMapper;
import java.util.*;
import java.lang.reflect.*;
import java.io.*;

public class AuditRedactionContract {
    static int checks;
    static final JacksonJsonMapper JSON = new JacksonJsonMapper();
    static final String PRIVATE = "fixture-sensitive-credential-82";
    static void check(boolean valid) { if(!valid) throw new AssertionError("Audit contract "+checks); checks++; }
    static class Service extends AuditServiceImpl {
        final boolean enabled;
        Service(boolean value) { enabled=value; }
        protected boolean credentialRedactionEnabled() { return enabled; }
    }
    static class Output extends AuditLogOutPutFilter {
        final boolean enabled;
        Output(boolean value) { enabled=value; }
        protected boolean credentialRedactionEnabled() { return enabled; }
    }
    public static class Response {
        public String getToken() { return PRIVATE; }
        public String getName() { return "fixture-response"; }
    }
    static Map<String,Object> map(Object... values) {
        Map<String,Object> result=new LinkedHashMap<>();
        for(int i=0;i<values.length;i+=2) result.put((String)values[i],values[i+1]);
        return result;
    }
    static Map<String,Object> serialize(boolean enabled,Object input,JacksonMapper mapper) throws Exception {
        Service service=new Service(enabled);
        Field field=AuditServiceImpl.class.getDeclaredField("jsonMapper");field.setAccessible(true);field.set(service,mapper);
        Method method=AuditServiceImpl.class.getDeclaredMethod("putInAsString",Map.class,String.class,String.class,String.class,Object.class);method.setAccessible(true);
        Map<String,Object> data=new HashMap<>();
        method.invoke(service,data,"container","responseObject","unused",input);
        return JSON.readValue((String)data.get("responseObject"),Map.class);
    }
    public static void main(String[] args) throws Exception {
        check(AuditCredentialRedactor.enabled() == io.cattle.platform.iaas.api.auth.localrbac.CustomizationConfig.CURRENT.enabled("AUDIT_CREDENTIAL_REDACTION_ENABLED"));
        JacksonMapper mapper=new JacksonMapper();mapper.init();
        String[] keys={"token","authenticationToken","id_token","refresh-token","X-API-Key","password","client_secret","Authorization","Proxy-Authorization","Cookie","Set-Cookie","headers","payload","secretValue","publicValue","privateKey","value","environment","dockerCompose","command","entrypoint","nestedConfig","certificate"};
        for(String key:keys) {
            Map<String,Object> input=map("name","visível","nested",Arrays.asList(map(key,PRIVATE,"status","active")));
            Map<String,Object> out=serialize(true,input,mapper);
            String text=JSON.writeValueAsString(out);
            check(!text.contains(PRIVATE));check(text.contains("active"));check("visível".equals(out.get("name")));
            check(JSON.writeValueAsString(input).contains(PRIVATE));
        }
        Map<String,Object> input=map("name","container-fixture","token",PRIVATE,"url","ws://localhost/v1/exec","status",200,"enabled",true,"empty",null);
        Map<String,Object> out=serialize(true,input,mapper);
        check(AuditCredentialRedactor.REDACTED.equals(out.get("token")));check("ws://localhost/v1/exec".equals(out.get("url")));check(Integer.valueOf(200).equals(out.get("status")));check(Boolean.TRUE.equals(out.get("enabled")));check(out.containsKey("empty"));
        check(PRIVATE.equals(serialize(false,input,mapper).get("token")));
        check(AuditCredentialRedactor.REDACTED.equals(serialize(true,new Response(),mapper).get("token")));
        check("fixture-response".equals(serialize(true,new Response(),mapper).get("name")));
        for(String url:Arrays.asList("https://user:password@localhost/x","ws://localhost/x?token="+PRIVATE,"https://localhost/x#"+PRIVATE,"text https://localhost/x?key="+PRIVATE,"jdbc:mysql://localhost/database?password="+PRIVATE))
            check(AuditCredentialRedactor.REDACTED.equals(AuditCredentialRedactor.redact(url)));
        check(AuditCredentialRedactor.REDACTED.equals(AuditCredentialRedactor.redact("abcdefgh.abcdefgh.abcdefgh")));
        check(AuditCredentialRedactor.REDACTED.equals(AuditCredentialRedactor.redact("-----BEGIN PRIVATE KEY-----")));
        Map<String,Object> deep=map("password",PRIVATE);
        for(int i=0;i<40;i++) deep=map("child",deep);
        check(!JSON.writeValueAsString(AuditCredentialRedactor.redact(deep)).contains(PRIVATE));
        Map<String,Object> wide=new LinkedHashMap<>();for(int i=0;i<25000;i++)wide.put("field"+i,"safe");
        Map<?,?> capped=(Map<?,?>)AuditCredentialRedactor.redact(wide);check(capped.size()<=20001);check(Boolean.TRUE.equals(capped.get("_auditTruncated")));
        String large=String.join("",Collections.nCopies(65537,"x"));check(AuditCredentialRedactor.REDACTED.equals(AuditCredentialRedactor.redact(large)));
        JacksonMapper broken=new JacksonMapper(){public void writeValue(OutputStream os,Object value) throws IOException {throw new IOException("synthetic private text omitted");}};
        broken.init();
        check(Boolean.TRUE.equals(serialize(true,input,broken).get("_auditUnavailable")));
        check(AuditCredentialRedactor.redact(new Object()).equals(AuditCredentialRedactor.REDACTED));
        for(boolean enabled:new boolean[]{false,true}) {
            Output output=new Output(enabled);
            Field mf=AuditLogOutPutFilter.class.getDeclaredField("jsonMapper");mf.setAccessible(true);mf.set(output,JSON);
            String original=JSON.writeValueAsString(input);
            ResourceImpl resource=new ResourceImpl("1al1","auditLog",map("requestObject",original,"responseObject",original,"responseCode",200,"data",map("fields",input)));
            output.filter(null,new AuditLogRecord(),resource);
            check(((String)resource.getFields().get("responseObject")).contains(PRIVATE)==!enabled);
            check(((String)resource.getFields().get("requestObject")).contains(PRIVATE)==!enabled);
            check(JSON.writeValueAsString(resource.getFields().get("data")).contains(PRIVATE)==!enabled);
            check(Integer.valueOf(200).equals(resource.getFields().get("responseCode")));
            check(original.contains(PRIVATE));
        }
        for(String invalid:Arrays.asList("not-json", "\"bare text\"", "{invalid", String.join("",Collections.nCopies(40,"["))+"0"+String.join("",Collections.nCopies(40,"]"))))
            check(AuditCredentialRedactor.redactJson(invalid,JSON).contains("_auditUnavailable"));
        check(!AuditCredentialRedactor.redactJson("{\"nested\":[{\"token\":\""+PRIVATE+"\"}],\"name\":\"braces { [ ] }\"}",JSON).contains(PRIVATE));
        System.out.println(checks+" audit redaction assertions passed");
    }
}
