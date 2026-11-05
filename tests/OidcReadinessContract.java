import io.cattle.platform.iaas.api.auth.localrbac.OidcReadiness;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
public class OidcReadinessContract {
    static int checks;
    static void check(boolean value) { if(!value) throw new AssertionError("Readiness contract failed at "+checks); checks++; }
    public static void main(String[] args) throws Exception {
        AtomicLong time=new AtomicLong();AtomicInteger calls=new AtomicInteger();
        OidcReadiness readiness=new OidcReadiness(1000,time::get);
        check(readiness.check(() -> { calls.incrementAndGet();return true; }));
        check(readiness.check(() -> { throw new AssertionError("Fresh cache must avoid new request"); }));
        check(calls.get()==1);
        time.set(1001);
        check(!readiness.check(() -> { calls.incrementAndGet();throw new Exception("sentinel-private-detail"); }));
        check(!readiness.check(() -> { throw new AssertionError("Negative cache must avoid new request"); }));
        check(calls.get()==2);
        time.set(2002);check(readiness.check(() -> { calls.incrementAndGet();return true; }));check(calls.get()==3);
        OidcReadiness concurrent=new OidcReadiness(1000,time::get);
        CountDownLatch entered=new CountDownLatch(1),release=new CountDownLatch(1);AtomicBoolean answer=new AtomicBoolean();
        Thread first=new Thread(() -> answer.set(concurrent.check(() -> { entered.countDown();if(!release.await(2,TimeUnit.SECONDS)) throw new Exception("Timed out");return true; })));
        first.start();
        try { check(entered.await(2,TimeUnit.SECONDS));check(!concurrent.check(() -> { throw new AssertionError("Second request cannot start an upstream probe"); })); }
        finally { release.countDown();first.join(3000); }
        check(!first.isAlive() && answer.get());
        check(concurrent.check(() -> { throw new AssertionError("Concurrent result must be cached"); }));
        System.out.println(checks+" readiness assertions passed; cache, failure, recovery and single-flight");
    }
}
