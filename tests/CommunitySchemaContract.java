import io.cattle.platform.iaas.api.auth.localrbac.CommunitySchemaMigrations;
import java.sql.*;

/** Real JDBC contract. The orchestrator supplies only a new owned MySQL copy. */
public class CommunitySchemaContract {
    public static void main(String[] args) throws Exception {
        try { execute(args); }
        catch (SQLException error) {
            String message = error.getMessage();
            String category = message != null && (message.startsWith("Community schema") || message.startsWith("Schema bootstrap")) ? message : "JDBC failure";
            System.out.println("SCHEMA-CONTRACT-FAILURE " + category + " SQLState=" + error.getSQLState() + " code=" + error.getErrorCode());
            throw new AssertionError("Real JDBC schema contract failed");
        }
    }
    private static void execute(String[] args) throws Exception {
        if (!"true".equals(System.getenv("COMMUNITY_SCHEMA_OWNED_TEST"))) { throw new AssertionError("Owned fixture required"); }
        if (args.length != 2 || !CommunitySchemaMigrations.checksum(CommunitySchemaMigrations.sql()).equals(args[1])) {
            throw new AssertionError("Packaged SQL differs from offline migration");
        }
        Class.forName("org.mariadb.jdbc.Driver");
        try (Connection connection = DriverManager.getConnection("jdbc:mysql://127.0.0.1:3306/cattle", "root", "")) {
            boolean refused = false;
            try { CommunitySchemaMigrations.apply(connection); } catch (SQLException expected) {
                if (!args[0].equals("expect-refusal")) { throw expected; }
                refused = true;
            }
            if (args[0].equals("expect-refusal") != refused) { throw new AssertionError("Schema refusal contract failed"); }
        }
        System.out.println("PASS: packaged SQL and real JDBC " + args[0]);
    }
}
