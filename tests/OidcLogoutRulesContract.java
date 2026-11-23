import io.cattle.platform.iaas.api.auth.localrbac.OidcLogoutRules;
import java.net.URI;
import java.net.URLDecoder;

public class OidcLogoutRulesContract {
    static int checks;
    static final String APP="https://console.example/oidc/callback", ISSUER="https://identity.example/realms/test";
    static void check(boolean valid) { if(!valid) throw new AssertionError("Logout contract "+checks); checks++; }
    static void reject(String endpoint) throws Exception {
        boolean rejected=false;
        try { OidcLogoutRules.destination(endpoint,ISSUER,APP,"console",false); }
        catch(Exception expected) { rejected=true; }
        check(rejected);
    }
    public static void main(String[] args) throws Exception {
        check(OidcLogoutRules.requestAllowed("https://console.example",APP,"csrf","csrf",false));
        check(OidcLogoutRules.requestAllowed("https://console.example:443",APP,"csrf","csrf",false));
        for(String origin:new String[]{null,"null","https://outside.example","https://console.example:444","http://console.example","https://user@console.example","https://console.example/path","https://console.example?x=1","https://console.example#x"}) {
            check(!OidcLogoutRules.requestAllowed(origin,APP,"csrf","csrf",false));
        }
        check(!OidcLogoutRules.requestAllowed("https://console.example",APP,null,"csrf",false));
        check(!OidcLogoutRules.requestAllowed("https://console.example",APP,"csrf",null,false));
        check(!OidcLogoutRules.requestAllowed("https://console.example",APP,"csrf","other",false));
        check(!OidcLogoutRules.requestAllowed("https://console.example",APP,"","",false));
        for(String endpoint:new String[]{"https://outside.example/logout","https://user:pass@identity.example/logout","https://identity.example/logout#fragment","http://identity.example/logout","javascript:alert(1)","//identity.example/logout","https://identity.example/logout?client_id=other","https://identity.example/logout?post_logout_redirect_uri=https://outside.example","https://identity.example/logout?id_token_hint=private","https://identity.example/logout?logout_hint=private"}) { reject(endpoint); }
        String target=OidcLogoutRules.destination(ISSUER+"/logout",ISSUER,APP,"console",false);
        check(target.startsWith(ISSUER+"/logout?client_id=console&"));
        check(URLDecoder.decode(new URI(target).getRawQuery(),"UTF-8").contains("post_logout_redirect_uri=https://console.example/console/login?oidc_logout=returned"));
        check(!target.contains("id_token_hint"));
        check(OidcLogoutRules.destination(ISSUER+"/logout?ui_locales=pt-BR",ISSUER,APP,"console",false).contains("ui_locales=pt-BR&client_id="));
        check(OidcLogoutRules.requestAllowed("http://localhost:18090","http://localhost:18090/oidc/callback","csrf","csrf",true));
        check(!OidcLogoutRules.requestAllowed("http://localhost:18090","http://localhost:18090/oidc/callback","csrf","csrf",false));
        System.out.println(checks+" logout origin/CSRF/destination assertions passed");
    }
}
