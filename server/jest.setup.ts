// Jest setup file to mock problematic ES modules

jest.mock('openid-client', () => ({
  Issuer: {
    discover: jest.fn().mockResolvedValue({
      Client: jest.fn().mockImplementation(() => ({
        callback: jest.fn(),
        userinfo: jest.fn(),
        authorizationUrl: jest.fn(),
      })),
      metadata: {},
    }),
  },
  Strategy: jest.fn(),
  generators: {
    codeVerifier: jest.fn().mockReturnValue('mock-code-verifier'),
    codeChallenge: jest.fn().mockReturnValue('mock-code-challenge'),
    state: jest.fn().mockReturnValue('mock-state'),
  },
}));

jest.mock('oauth4webapi', () => ({
  // Mock oauth4webapi exports if needed
}));
