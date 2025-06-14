import { SocialAuthServiceConfig, GoogleLoginProvider } from '@abacritt/angularx-social-login';

export const socialAuthConfig: SocialAuthServiceConfig = {
  autoLogin: false,
  providers: [
    {
      id: GoogleLoginProvider.PROVIDER_ID,
      provider: new GoogleLoginProvider('910347869788-astuldpi4hi3hb0osucuoclhfjdh5dtj.apps.googleusercontent.com'),
    },
  ],
};
