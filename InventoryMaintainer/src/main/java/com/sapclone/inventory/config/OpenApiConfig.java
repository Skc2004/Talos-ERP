package com.sapclone.inventory.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI talosOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("Talos ERP — Enterprise API")
                        .description("Composable API for Inventory Management, Finance, CRM, and AI Intelligence. "
                                   + "Use these endpoints to integrate Talos with external systems or build custom modules.")
                        .version("3.0.0")
                        .contact(new Contact()
                                .name("Talos ERP Team")
                                .email("admin@talos.com"))
                        .license(new License()
                                .name("Proprietary")
                                .url("https://github.com/Skc2004/Talos-ERP")));
    }
}
