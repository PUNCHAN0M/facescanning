export interface AppConfig {
  apiUrl: string;
  appUrl: string;
  oidcAuth: {
    enabled: boolean;
    config: {
      authority: string;
      client_id: string;
      redirect_uri: string;
      post_logout_redirect_uri: string;
      scope?: string;
      response_type?: string;
    };
  };
}

export interface SiteConfig {
  name: string;
  title: string;
  description: string;
  url: string;
  ogImage: string;
  creator: string;
  keywords: string[];
}
