import io.cattle.platform.host.stats.api.StatsAccess;
import io.cattle.platform.host.stats.api.StatsPayloadTransport;
import io.cattle.platform.token.TokenService;
import io.github.ibuildthecloud.gdapi.exception.ClientVisibleException;
import java.util.*;

public class StatsPayloadRulesContract {
    static int checks, calls;
    static void check(boolean value) { if (!value) throw new AssertionError("Stats payload contract " + checks); checks++; }
    static String text(int length) { char[] value = new char[length]; Arrays.fill(value, 'a'); return new String(value); }
    static TokenService tokens = new TokenService() {
        public String generateToken(Map<String,Object> payload) {
            calls++;
            check(payload.size() == 1 && Boolean.TRUE.equals(payload.get("payload")));
            return "public-envelope-fixture";
        }
        public String generateToken(Map<String,Object> payload, Date expire) { throw new AssertionError(); }
        public String generateEncryptedToken(Map<String,Object> payload) { throw new AssertionError(); }
        public String generateEncryptedToken(Map<String,Object> payload, Date expire) { throw new AssertionError(); }
        public Map<String,Object> getJsonPayload(String value, boolean encrypted) { throw new AssertionError(); }
    };
    static StatsAccess access(int length) { StatsAccess value = new StatsAccess(); value.setUrl("ws://localhost/v1/containerstats/service"); value.setToken(text(length)); return value; }
    public static void main(String[] args) {
        for (boolean enabled : new boolean[]{false,true}) for (String optIn : new String[]{null,"0","true"," 1","1"}) {
            calls = 0;
            StatsAccess value = access(5000);
            String original = value.getToken();
            check(StatsPayloadTransport.prepare(value,enabled,optIn,tokens) == value);
            boolean negotiated = enabled && "1".equals(optIn);
            check(calls == (negotiated ? 1 : 0));
            check(negotiated ? original.equals(value.getPayload()) : value.getPayload() == null);
            check(negotiated ? "public-envelope-fixture".equals(value.getToken()) : original.equals(value.getToken()));
            check("ws://localhost/v1/containerstats/service".equals(value.getUrl()));
        }
        calls = 0;
        StatsAccess small = access(StatsPayloadTransport.URL_TOKEN_LIMIT);
        check(StatsPayloadTransport.prepare(small,true,"1",tokens).getPayload() == null && calls == 0);
        StatsAccess boundary = access(StatsPayloadTransport.PAYLOAD_LIMIT);
        check(StatsPayloadTransport.prepare(boundary,true,"1",tokens).getPayload().length() == StatsPayloadTransport.PAYLOAD_LIMIT);
        StatsAccess oversized = access(StatsPayloadTransport.PAYLOAD_LIMIT+1);
        boolean denied = false;
        try { StatsPayloadTransport.prepare(oversized,true,"1",tokens); } catch (ClientVisibleException expected) { denied = true; }
        check(denied);
        check(oversized.getPayload() == null);
        check(StatsPayloadTransport.prepare(null,true,"1",tokens) == null);
        check(StatsPayloadTransport.prepare(new StatsAccess(),true,"1",tokens).getToken() == null);
        System.out.println(checks + " stats payload rules passed");
    }
}
