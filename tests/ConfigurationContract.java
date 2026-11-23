import io.cattle.platform.iaas.api.auth.localrbac.CustomizationConfig;
import java.util.*;

public class ConfigurationContract {
    static int checks;
    static void check(boolean valid) { if(!valid) throw new AssertionError("Configuration contract failed at "+checks); checks++; }
    static Map<String,String> base() {
        Map<String,String> env=new HashMap<>();
        env.put("RANCHER_OIDC_ISSUER","https://idp.example/realm");
        env.put("RANCHER_OIDC_CLIENT_ID","rancher");
        env.put("RANCHER_OIDC_CALLBACK","https://rancher.example/oidc/callback");
        return env;
    }
    static void rejects(Map<String,String> env) {
        boolean rejected=false;
        try { new CustomizationConfig(env); } catch(IllegalArgumentException expected) { rejected=true; }
        check(rejected);
    }
    public static void main(String[] args) {
        for(int bits=0;bits<64;bits++) {
            Map<String,String> env=base();
            String[] keys={"CUSTOMIZATION_ENABLED","OIDC_ENABLED","OIDC_ONLY","OIDC_AUTO_LOGIN","LOCAL_RBAC_ENABLED","MODERN_UI_ENABLED"};
            for(int i=0;i<keys.length;i++) env.put("RANCHER_"+keys[i],String.valueOf((bits&(1<<i))!=0));
            boolean custom=(bits&1)!=0, oidc=(bits&2)!=0, exclusive=(bits&4)!=0, auto=(bits&8)!=0, groups=(bits&16)!=0, modern=(bits&32)!=0;
            if(modern || ((exclusive||auto)&&!(custom&&oidc))) { rejects(env); continue; }
            CustomizationConfig config=new CustomizationConfig(env);
            check(config.enabled("LOCAL_RBAC_ENABLED")== (custom&&groups));
            check(config.enabled("OIDC_ENABLED")== (custom&&oidc));
            check(config.enabled("ENV_CREATION_ADMIN_ONLY"));
            check(config.enabled("DISABLE_AUTO_ENVIRONMENT"));
        }
        Map<String,String> invalid=base();invalid.put("RANCHER_LOCAL_RBAC_ENABLED","yes");rejects(invalid);
        invalid=base();invalid.remove("RANCHER_OIDC_CALLBACK");rejects(invalid);
        invalid=base();invalid.put("RANCHER_OIDC_ISSUER","http://idp.example/realm");rejects(invalid);
        invalid=base();invalid.put("RANCHER_OIDC_CALLBACK","https://user:secret@rancher.example/callback");rejects(invalid);
        CustomizationConfig noProvider=new CustomizationConfig(Collections.<String,String>emptyMap());
        check(!noProvider.enabled("OIDC_ENABLED"));
        check(noProvider.enabled("CATALOG_WRITE_GUARD_ENABLED"));
        check(noProvider.enabled("SESSION_ACCOUNT_GUARD_ENABLED"));
        Map<String,String> legacySession=base();legacySession.put("RANCHER_SESSION_ACCOUNT_GUARD_ENABLED","false");
        check(!new CustomizationConfig(legacySession).enabled("SESSION_ACCOUNT_GUARD_ENABLED"));
        invalid=base();invalid.put("RANCHER_SESSION_ACCOUNT_GUARD_ENABLED","yes");rejects(invalid);
        Map<String,String> legacyCatalog=base();legacyCatalog.put("RANCHER_CATALOG_WRITE_GUARD_ENABLED","false");
        check(!new CustomizationConfig(legacyCatalog).enabled("CATALOG_WRITE_GUARD_ENABLED"));
        invalid=base();invalid.put("RANCHER_CATALOG_WRITE_GUARD_ENABLED","yes");rejects(invalid);
        check(!new CustomizationConfig(base()).enabled("OIDC_LOGIN_PREFLIGHT_ENABLED"));
        for(int bits=0;bits<4;bits++) {
            Map<String,String> probe=base();
            probe.put("RANCHER_OIDC_LOGIN_PREFLIGHT_ENABLED","true");
            probe.put("RANCHER_CUSTOMIZATION_ENABLED",String.valueOf((bits&1)!=0));
            probe.put("RANCHER_OIDC_ENABLED",String.valueOf((bits&2)!=0));
            check(new CustomizationConfig(probe).enabled("OIDC_LOGIN_PREFLIGHT_ENABLED")==((bits&3)==3));
        }
        invalid=base();invalid.put("RANCHER_OIDC_LOGIN_PREFLIGHT_ENABLED","yes");rejects(invalid);
        check(!new CustomizationConfig(base()).enabled("SUBSCRIPTION_SESSION_GUARD_ENABLED"));
        Map<String,String> streams=base();streams.put("RANCHER_SUBSCRIPTION_SESSION_GUARD_ENABLED","true");
        check(new CustomizationConfig(streams).enabled("SUBSCRIPTION_SESSION_GUARD_ENABLED"));
        streams.put("RANCHER_CUSTOMIZATION_ENABLED","false");check(!new CustomizationConfig(streams).enabled("SUBSCRIPTION_SESSION_GUARD_ENABLED"));
        streams=base();streams.put("RANCHER_SUBSCRIPTION_SESSION_GUARD_ENABLED","yes");rejects(streams);
        check(!new CustomizationConfig(base()).enabled("OIDC_FEDERATED_LOGOUT_ENABLED"));
        for(int bits=0;bits<4;bits++) {
            Map<String,String> logout=base();logout.put("RANCHER_OIDC_FEDERATED_LOGOUT_ENABLED","true");
            logout.put("RANCHER_CUSTOMIZATION_ENABLED",String.valueOf((bits&1)!=0));
            logout.put("RANCHER_OIDC_ENABLED",String.valueOf((bits&2)!=0));
            check(new CustomizationConfig(logout).enabled("OIDC_FEDERATED_LOGOUT_ENABLED")==((bits&3)==3));
        }
        invalid=base();invalid.put("RANCHER_OIDC_FEDERATED_LOGOUT_ENABLED","yes");rejects(invalid);
        check(!new CustomizationConfig(base()).enabled("SCHEMA_MIGRATIONS_ENABLED"));
        Map<String,String> schema=base();schema.put("RANCHER_SCHEMA_MIGRATIONS_ENABLED","true");
        check(new CustomizationConfig(schema).enabled("SCHEMA_MIGRATIONS_ENABLED"));
        schema.put("RANCHER_CUSTOMIZATION_ENABLED","false");check(!new CustomizationConfig(schema).enabled("SCHEMA_MIGRATIONS_ENABLED"));
        schema=base();schema.put("RANCHER_SCHEMA_MIGRATIONS_ENABLED","yes");rejects(schema);
        check(!new CustomizationConfig(base()).enabled("HOST_STREAM_SESSION_GUARD_ENABLED"));
        Map<String,String> hostStreams=base();hostStreams.put("RANCHER_HOST_STREAM_SESSION_GUARD_ENABLED","true");
        rejects(hostStreams);
        hostStreams.put("RANCHER_HOST_STREAM_PROXY_PROTOCOL","1");
        check(new CustomizationConfig(hostStreams).enabled("HOST_STREAM_SESSION_GUARD_ENABLED"));
        hostStreams.put("RANCHER_CUSTOMIZATION_ENABLED","false");
        check(!new CustomizationConfig(hostStreams).enabled("HOST_STREAM_SESSION_GUARD_ENABLED"));
        hostStreams.put("RANCHER_HOST_STREAM_SESSION_GUARD_ENABLED","yes");rejects(hostStreams);
        check(!new CustomizationConfig(base()).enabled("METRICS_PAYLOAD_TRANSPORT_ENABLED"));
        Map<String,String> payloads=base();payloads.put("RANCHER_METRICS_PAYLOAD_TRANSPORT_ENABLED","true");rejects(payloads);
        payloads.put("RANCHER_HOST_STREAM_PROXY_PROTOCOL","1");rejects(payloads);
        payloads.put("RANCHER_METRICS_PAYLOAD_PROXY_PROTOCOL","1");check(new CustomizationConfig(payloads).enabled("METRICS_PAYLOAD_TRANSPORT_ENABLED"));
        payloads.put("RANCHER_CUSTOMIZATION_ENABLED","false");check(!new CustomizationConfig(payloads).enabled("METRICS_PAYLOAD_TRANSPORT_ENABLED"));
        payloads.put("RANCHER_METRICS_PAYLOAD_TRANSPORT_ENABLED","yes");rejects(payloads);
        Map<String,String> secret=base();secret.put("RANCHER_OIDC_CLIENT_SECRET","sentinel-secret-never-public");
        check(!new CustomizationConfig(secret).publicConfig().toString().contains("sentinel-secret"));
        System.out.println(checks+" configuration assertions passed across 64 combinations");
    }
}
