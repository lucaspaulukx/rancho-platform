import io.cattle.platform.iaas.api.auth.localrbac.UiHostStreamSessionGuard;
import io.github.ibuildthecloud.gdapi.exception.ClientVisibleException;

public class HostStreamRulesContract {
    static int checks;
    static void check(boolean value) { if (!value) throw new AssertionError("Host stream contract " + checks); checks++; }
    public static void main(String[] args) {
        check(Long.valueOf(1).equals(UiHostStreamSessionGuard.id("1")));
        check(Long.valueOf(Long.MAX_VALUE).equals(UiHostStreamSessionGuard.id(String.valueOf(Long.MAX_VALUE))));
        for (Object value : new Object[]{null, 1, "0", "01", "-1", " 1", "1.0", "9223372036854775808"}) {
            check(UiHostStreamSessionGuard.id(value) == null);
        }
        check("/v1/logs".equals(UiHostStreamSessionGuard.path("v1", "logs")));
        check("/v1/stats/fixture".equals(UiHostStreamSessionGuard.path("/v1", "/stats", "fixture")));
        for (String value : new String[]{"", "/v1?token=x", "/v1#fragment", "/v1\\logs", "/v1//logs", "/v1/ log", "/v1/\nlogs"}) {
            boolean denied = false;
            try { UiHostStreamSessionGuard.path(value); } catch (ClientVisibleException expected) { denied = true; }
            check(denied);
        }
        String fingerprint = UiHostStreamSessionGuard.fingerprint("public-test-fixture");
        check(fingerprint.matches("[a-f0-9]{64}"));
        check(fingerprint.equals(UiHostStreamSessionGuard.fingerprint("public-test-fixture")));
        check(!fingerprint.equals(UiHostStreamSessionGuard.fingerprint("different-fixture")));
        check(UiHostStreamSessionGuard.trustedProxy(UiHostStreamSessionGuard.proxyKey()));
        check(!UiHostStreamSessionGuard.trustedProxy(null));
        check(!UiHostStreamSessionGuard.trustedProxy("public-test-fixture"));
        check(!UiHostStreamSessionGuard.proxyKey().contains(fingerprint));
        System.out.println(checks + " host stream rules passed");
    }
}
