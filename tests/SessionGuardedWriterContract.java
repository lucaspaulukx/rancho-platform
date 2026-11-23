import io.cattle.platform.api.pubsub.subscribe.MessageWriter;
import io.cattle.platform.iaas.api.auth.localrbac.SessionGuardedWriter;
import java.io.IOException;

public class SessionGuardedWriterContract {
    static int checks;
    static void check(boolean condition) { if (!condition) throw new AssertionError("Writer contract " + checks); checks++; }
    static class Sink implements MessageWriter {
        int written, closed;
        public void write(String message, Object lock) { written++; }
        public void close() { closed++; }
    }
    public static void main(String[] args) throws Exception {
        Sink sink = new Sink();
        final boolean[] allowed = {true};
        SessionGuardedWriter writer = new SessionGuardedWriter(sink, () -> allowed[0]);
        writer.write("before", new Object()); check(sink.written == 1);
        allowed[0] = false;
        try { writer.write("private-after", new Object()); throw new AssertionError(); } catch (IOException expected) { checks++; }
        check(sink.written == 1); check(sink.closed == 1);
        allowed[0] = true;
        try { writer.write("cannot-reopen", new Object()); throw new AssertionError(); } catch (IOException expected) { checks++; }
        writer.close(); check(sink.closed == 1); check(sink.written == 1);
        Sink errorSink = new Sink();
        SessionGuardedWriter unavailable = new SessionGuardedWriter(errorSink, () -> { throw new IllegalStateException("private-data"); });
        try { unavailable.write("blocked", new Object()); throw new AssertionError(); } catch (IOException expected) { check(!expected.getMessage().contains("private-data")); }
        check(errorSink.written == 0); check(errorSink.closed == 1);
        System.out.println(checks + " guarded writer assertions passed");
    }
}
