import io.cattle.platform.iaas.api.auth.localrbac.*;
import io.cattle.platform.iaas.api.auth.dao.AuthDao;
import io.cattle.platform.core.dao.AccountDao;
import io.cattle.platform.object.ObjectManager;
import io.cattle.platform.token.TokenService;
import io.cattle.platform.core.model.*;
import io.cattle.platform.core.model.tables.records.*;
import java.util.*;
import java.lang.reflect.*;
import com.nimbusds.jose.*;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jwt.*;

public class ApiKeyStreamContract {
    static int checks;
    static Map<String,Object> claims;
    static CredentialRecord key=new CredentialRecord();
    static AccountRecord owner=new AccountRecord(),project=new AccountRecord();
    static HostRecord host=new HostRecord();
    static boolean active=true;
    static String role="member";
    static void check(boolean value) {if(!value)throw new AssertionError("API key stream contract "+checks);checks++;}
    static Object proxy(Class<?> type,InvocationHandler call) {return Proxy.newProxyInstance(type.getClassLoader(),new Class<?>[]{type},call);}
    static void inject(Object target,String field,Object value)throws Exception {Field f=target.getClass().getDeclaredField(field);f.setAccessible(true);f.set(target,value);}
    static Map<String,Object> binding() {Map<String,Object>b=new HashMap<>();b.put("v",1);b.put("mode","apikey");b.put("path","/v1/exec");b.put("tokenId","9");b.put("userId","10");b.put("projectId","12");b.put("hostId","1");b.put("userKind",owner.getKind());b.put("role",role);b.put("uiExp",System.currentTimeMillis()/1000+60);b.put("sessionHash",UiHostStreamSessionGuard.credentialFingerprint(key));return b;}
    static void reset() {key.setId(9L);key.setAccountId(10L);key.setKind("apiKey");key.setState("active");key.setUuid("public-fixture-uuid");key.setPublicValue("public-fixture-key");key.setSecretValue("public-fixture-hash");key.setRemoved(null);owner.setId(10L);owner.setKind("admin");owner.setState("active");project.setId(12L);project.setKind("project");project.setState("active");host.setAccountId(12L);host.setState("active");host.setRemoved(null);active=true;role="owner";claims=new HashMap<>();claims.put("exp",System.currentTimeMillis()/1000+60);claims.put("rancherStream",binding());}
    @SuppressWarnings("unchecked")
    public static void main(String[] args)throws Exception {
        check(CustomizationConfig.CURRENT.enabled("API_KEY_STREAM_GUARD_ENABLED"));
        java.security.KeyPairGenerator gen=java.security.KeyPairGenerator.getInstance("RSA");gen.initialize(2048);
        SignedJWT jwt=new SignedJWT(new JWSHeader(JWSAlgorithm.RS256),new JWTClaimsSet.Builder().expirationTime(new Date(System.currentTimeMillis()+60000)).build());
        jwt.sign(new RSASSASigner((java.security.interfaces.RSAPrivateKey)gen.generateKeyPair().getPrivate()));String proof=jwt.serialize();
        UiHostStreamSessionGuard guard=new UiHostStreamSessionGuard();
        inject(guard,"tokenService",proxy(TokenService.class,(p,m,a)->m.getName().equals("getJsonPayload")?claims:null));
        inject(guard,"objectManager",proxy(ObjectManager.class,(p,m,a)->a[0]==Credential.class?key:a[0]==Host.class?host:null));
        inject(guard,"authDao",proxy(AuthDao.class,(p,m,a)->m.getName().equals("getAccountById")?(((Long)a[0])==12L?project:owner):null));
        inject(guard,"accountDao",proxy(AccountDao.class,(p,m,a)->m.getName().equals("isActiveAccount")?active:null));
        reset();check(guard.allowed(proof,"/v1/exec"));check(!guard.allowed(proof,"/v1/logs"));
        for(String field:new String[]{"state","removed","kind","owner","public","secret","uuid","host","account","expiry","fingerprint","mode","userKind","role"}) {
            reset();Map<String,Object>b=(Map<String,Object>)claims.get("rancherStream");
            switch(field){case "state":key.setState("inactive");break;case "removed":key.setRemoved(new Date());break;case "kind":key.setKind("agentApiKey");break;case "owner":key.setAccountId(11L);break;case "public":key.setPublicValue("rotated");break;case "secret":key.setSecretValue("rotated");break;case "uuid":key.setUuid("rotated");break;case "host":host.setAccountId(13L);break;case "account":active=false;break;case "expiry":b.put("uiExp",1);break;case "fingerprint":b.put("sessionHash","bad");break;case "mode":b.put("mode","technical");break;case "userKind":b.put("userKind","user");break;case "role":b.put("role","member");break;}
            check(!guard.allowed(proof,"/v1/exec"));
        }
        reset();owner.setKind("project");owner.setId(12L);key.setAccountId(12L);Map<String,Object>b=binding();b.put("userId","12");claims.put("rancherStream",b);check(guard.allowed(proof,"/v1/exec"));
        key.setAccountId(13L);check(!guard.allowed(proof,"/v1/exec"));
        System.out.println(checks+" API key stream assertions passed");
    }
}
