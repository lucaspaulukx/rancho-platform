import io.cattle.platform.host.stats.api.StatsAccess;
import io.cattle.platform.host.stats.api.StatsPayloadTransport;
import io.cattle.platform.iaas.api.auth.localrbac.CustomizationConfig;
import io.cattle.platform.token.TokenService;
import io.github.ibuildthecloud.gdapi.exception.ClientVisibleException;
import java.util.*;

public class StatsNegotiationContract {
    static int checks;
    static Map<String,Object> root, child, envelope;
    static void check(boolean value) { if (!value) throw new AssertionError("Negotiation contract " + checks); checks++; }
    static TokenService tokens = new TokenService() {
        public String generateToken(Map<String,Object> claims) { envelope = claims; return "public-short-envelope"; }
        public String generateToken(Map<String,Object> claims, Date expire) { throw new AssertionError(); }
        public String generateEncryptedToken(Map<String,Object> claims) { throw new AssertionError(); }
        public String generateEncryptedToken(Map<String,Object> claims, Date expire) { throw new AssertionError(); }
        public Map<String,Object> getJsonPayload(String value, boolean encrypted) { check(!encrypted); return "child".equals(value) ? child : root; }
    };
    static StatsAccess access() {
        StatsAccess access = new StatsAccess();
        char[] text = new char[5000]; Arrays.fill(text,'a'); access.setToken(new String(text));
        access.setUrl("ws://localhost/v1/containerstats/service/"); return access;
    }
    static void reset(String mode) {
        child = new HashMap<>(); child.put("rancherStream",Collections.singletonMap("mode",mode));
        if ("ui".equals(mode)) child.put("rancherStreamProof","public-compact-proof");
        root = child; envelope = null;
    }
    public static void main(String[] args) {
        check(CustomizationConfig.CURRENT.enabled("HOST_STREAM_SESSION_GUARD_ENABLED"));
        for (String variant : new String[]{"direct","service","project","technical"}) {
            reset("technical".equals(variant) ? "technical" : "ui");
            if ("service".equals(variant) || "project".equals(variant)) {
                root = Collections.<String,Object>singletonMap(variant,Collections.singletonList(Collections.singletonMap("token","child")));
            }
            StatsAccess access = access(); String original = access.getToken();
            StatsPayloadTransport.prepare(access,true,"1",tokens);
            check(Boolean.TRUE.equals(envelope.get("payload")) && envelope.size()==2);
            Map<?,?> negotiation = (Map<?,?>)envelope.get("rancherNegotiation");
            check("/v1/containerstats/service/".equals(negotiation.get("path")));
            check(("technical".equals(variant) ? "technical" : "ui").equals(negotiation.get("mode")));
            check("technical".equals(variant) ? !negotiation.containsKey("proof") : "public-compact-proof".equals(negotiation.get("proof")));
            check(!envelope.toString().contains(original));
            check(original.equals(access.getPayload()));
        }
        for (String variant : new String[]{"missing","empty-batch","missing-proof","query"}) {
            reset("ui"); StatsAccess access = access();
            if ("missing".equals(variant)) root = Collections.emptyMap();
            if ("empty-batch".equals(variant)) root = Collections.<String,Object>singletonMap("service",Collections.emptyList());
            if ("missing-proof".equals(variant)) child.remove("rancherStreamProof");
            if ("query".equals(variant)) access.setUrl(access.getUrl()+"?unexpected=1");
            boolean denied = false;
            try { StatsPayloadTransport.prepare(access,true,"1",tokens); } catch(ClientVisibleException expected) { denied=true; }
            check(denied && access.getPayload()==null && envelope==null);
        }
        System.out.println(checks+" negotiation envelope rules passed");
    }
}
