package io.cattle.platform.spring.web;

import javax.servlet.ServletContext;
import javax.servlet.ServletContextEvent;
import javax.servlet.ServletContextListener;

import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.util.ClassUtils;

import com.codahale.metrics.MetricRegistry;
import com.codahale.metrics.health.HealthCheckRegistry;
import com.codahale.metrics.servlets.HealthCheckServlet;
import com.codahale.metrics.servlets.MetricsServlet;

public class ServletApplicationContext implements ServletContextListener {

    private static final String ROOT = ServletApplicationContext.class.getName();

    public static AnnotationConfigApplicationContext getRequiredContext(ServletContext servlet) {
        Object context = servlet.getAttribute(ROOT);
        if (!(context instanceof AnnotationConfigApplicationContext)) {
            throw new IllegalStateException("The application context has not been initialized");
        }
        return (AnnotationConfigApplicationContext) context;
    }

    @Override
    public void contextInitialized(ServletContextEvent event) {
        ServletContext servlet = event.getServletContext();
        AnnotationConfigApplicationContext context = new AnnotationConfigApplicationContext();
        try {
            Class<?> config = ClassUtils.resolveClassName(servlet.getInitParameter("contextConfigLocation"), servlet.getClassLoader());
            context.register(config);
            context.refresh();
            servlet.setAttribute(MetricsServlet.METRICS_REGISTRY, context.getBean(MetricRegistry.class));
            servlet.setAttribute(HealthCheckServlet.HEALTH_CHECK_REGISTRY, context.getBean(HealthCheckRegistry.class));
            servlet.setAttribute(ROOT, context);
        } catch (RuntimeException | Error e) {
            context.close();
            throw e;
        }
    }

    @Override
    public void contextDestroyed(ServletContextEvent event) {
        ServletContext servlet = event.getServletContext();
        Object context = servlet.getAttribute(ROOT);
        servlet.removeAttribute(ROOT);
        if (context instanceof AnnotationConfigApplicationContext) {
            ((AnnotationConfigApplicationContext) context).close();
        }
    }
}
