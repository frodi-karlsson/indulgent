import {
  ApiService,
  type Endpoint,
  type GenericFetcher,
} from './apiService.js';
import { describe, expect, test, vi } from 'vitest';

describe('ApiService', () => {
  describe('get method with query parameters', () => {
    type TestGetEndpoint = Endpoint<{
      method: 'GET';
      path: '/test-endpoint';
      query?: { search?: string; page?: number };
      response: { results: unknown[] };
    }>;

    const testCasesGetWithQuery: {
      params?: Record<string, string | number>;
      expectedUrl: string;
      description: string;
    }[] = [
      {
        description: 'no params, no data',
        params: undefined,
        expectedUrl: '/test-endpoint',
      },
      {
        description: 'with params, no data',
        params: { search: 'query', page: 2 },
        expectedUrl: '/test-endpoint?search=query&page=2',
      },
    ];
    const mockFetcher = createMockFetcher();

    class TestApiService extends ApiService<TestGetEndpoint> {}
    const apiService = new TestApiService({
      fetcher: mockFetcher,
    });

    test.each(testCasesGetWithQuery)(
      'should call fetcher.%s with correct parameters',
      async (testCase) => {
        const { params, expectedUrl } = testCase;

        await apiService.get('/test-endpoint', {
          query: params,
        });

        expect(mockFetcher.fetch).toHaveBeenCalledWith(
          expectedUrl,
          'GET',
          undefined,
          {},
        );
      },
    );
  });

  describe('post method with body', () => {
    type TestPostEndpoint = Endpoint<{
      method: 'POST';
      path: '/test-endpoint';
      request: { a: string; b: number } | undefined;
      response: { c: boolean };
    }>;

    const testCasesPostWithBody: {
      body?: { a: string; b: number };
      expectedBody?: string | undefined;
      description: string;
    }[] = [
      {
        description: 'no body',
        body: undefined,
        expectedBody: undefined,
      },
      {
        description: 'with body as object',
        body: { a: 'value', b: 42 },
        expectedBody: JSON.stringify({ a: 'value', b: 42 }),
      },
      {
        description: 'with body as string',
        body: '{"a":"value","b":42}' as unknown as { a: string; b: number },
        expectedBody: '{"a":"value","b":42}',
      },
    ];
    const mockFetcher = createMockFetcher();

    class TestApiService extends ApiService<TestPostEndpoint> {}
    const apiService = new TestApiService({
      fetcher: mockFetcher,
    });

    test.each(testCasesPostWithBody)(
      'should call fetcher $description with correct parameters',
      async (testCase) => {
        const { body, expectedBody } = testCase;

        await apiService.post('/test-endpoint', {
          body,
        });

        expect(mockFetcher.fetch).toHaveBeenCalledWith(
          '/test-endpoint',
          'POST',
          expectedBody,
          {},
        );
      },
    );
  });

  describe('put method with body', () => {
    type TestPutEndpoint = Endpoint<{
      method: 'PUT';
      path: '/test-endpoint';
      request: { a: string; b: number } | undefined;
      response: { c: boolean };
    }>;

    const testCasesPutWithBody: {
      body?: { a: string; b: number };
      expectedBody?: string | undefined;
      description: string;
    }[] = [
      {
        description: 'no body',
        body: undefined,
      },
      {
        description: 'with body as object',
        body: { a: 'value', b: 42 },
        expectedBody: JSON.stringify({ a: 'value', b: 42 }),
      },
      {
        description: 'with body as string',
        body: '{"a":"value","b":42}' as unknown as { a: string; b: number },
        expectedBody: '{"a":"value","b":42}',
      },
    ];
    const mockFetcher = createMockFetcher();

    class TestApiService extends ApiService<TestPutEndpoint> {}
    const apiService = new TestApiService({
      fetcher: mockFetcher,
    });

    test.each(testCasesPutWithBody)(
      'should call fetcher $description with correct parameters',
      async (testCase) => {
        const { body, expectedBody } = testCase;

        await apiService.put('/test-endpoint', {
          body,
        });

        expect(mockFetcher.fetch).toHaveBeenCalledWith(
          '/test-endpoint',
          'PUT',
          expectedBody,
          {},
        );
      },
    );
  });

  describe('delete method with body', () => {
    type TestDeleteEndpoint = Endpoint<{
      method: 'DELETE';
      path: '/test-endpoint';
      request: { a: string; b: number } | undefined;
      response: { c: boolean };
      body?: { a: string; b: number };
    }>;

    const testCasesDeleteWithBody: {
      body?: { a: string; b: number };
      expectedBody?: string | undefined;
      description: string;
    }[] = [
      {
        description: 'no body',
        body: undefined,
        expectedBody: undefined,
      },
      {
        description: 'with body as object',
        body: { a: 'value', b: 42 },
        expectedBody: JSON.stringify({ a: 'value', b: 42 }),
      },
      {
        description: 'with body as string',
        body: '{"a":"value","b":42}' as unknown as { a: string; b: number },
        expectedBody: '{"a":"value","b":42}',
      },
    ];
    const mockFetcher = createMockFetcher();

    class TestApiService extends ApiService<TestDeleteEndpoint> {}
    const apiService = new TestApiService({
      fetcher: mockFetcher,
    });

    test.each(testCasesDeleteWithBody)(
      'should call fetcher $description with correct parameters',
      async (testCase) => {
        const { body, expectedBody } = testCase;

        await apiService.delete('/test-endpoint', {
          body,
        });

        expect(mockFetcher.fetch).toHaveBeenCalledWith(
          '/test-endpoint',
          'DELETE',
          expectedBody,
          {},
        );
      },
    );
  });

  describe('get method with path parameters', () => {
    type TestEndpointWithPathParams = Endpoint<{
      method: 'GET';
      path: '/test-endpoint/:id/details/:detailId';
      query?: { verbose?: boolean };
      response: unknown;
    }>;

    const testCasesGetWithPathParams: {
      pathParams: { id: string; detailId: string };
      query?: { verbose?: boolean };
      expectedUrl: string;
      description: string;
    }[] = [
      {
        description: 'with path params, no query params',
        pathParams: { id: '123', detailId: '456' },
        query: undefined,
        expectedUrl: '/test-endpoint/123/details/456',
      },
      {
        description: 'with path params and query params',
        pathParams: { id: '123', detailId: '456' },
        query: { verbose: true },
        expectedUrl: '/test-endpoint/123/details/456?verbose=true',
      },
    ];
    const mockFetcher = createMockFetcher();

    class TestApiService extends ApiService<TestEndpointWithPathParams> {}
    const apiService = new TestApiService({
      fetcher: mockFetcher,
    });

    test.each(testCasesGetWithPathParams)(
      'should call fetcher $description with correct parameters',
      async (testCase) => {
        const { pathParams, query, expectedUrl } = testCase;

        await apiService.get('/test-endpoint/:id/details/:detailId', {
          pathParams,
          query,
        });

        expect(mockFetcher.fetch).toHaveBeenCalledWith(
          expectedUrl,
          'GET',
          undefined,
          {},
        );
      },
    );
  });

  describe('constructor parameters', () => {
    type TestEndpoint = Endpoint<{
      method: 'GET';
      path: '/test-endpoint/:id/details/:detailId';
      query?: { verbose?: boolean };
      response: unknown;
    }>;

    const mockFetcher = createMockFetcher();
    class TestApiService extends ApiService<TestEndpoint> {}
    const baseUrl = 'https://api.example.com/v1';
    const apiService = new TestApiService({
      fetcher: mockFetcher,
      baseUrl,
    });

    test('should prepend baseUrl to request URL', async () => {
      const pathParams = { id: '123', detailId: '456' };
      const query = { verbose: true };
      const expectedUrl =
        'https://api.example.com/v1/test-endpoint/123/details/456?verbose=true';

      await apiService.get('/test-endpoint/:id/details/:detailId', {
        pathParams,
        query,
      });

      expect(mockFetcher.fetch).toHaveBeenCalledWith(
        expectedUrl,
        'GET',
        undefined,
        {},
      );
    });

    test('should handle trailing slash in baseUrl', async () => {
      const apiServiceWithSlash = new TestApiService({
        fetcher: mockFetcher,
        baseUrl: 'https://api.example.com/v1/',
      });
      const pathParams = { id: '123', detailId: '456' };
      const query = { verbose: true };
      const expectedUrl =
        'https://api.example.com/v1/test-endpoint/123/details/456?verbose=true';

      await apiServiceWithSlash.get('/test-endpoint/:id/details/:detailId', {
        pathParams,
        query,
      });

      expect(mockFetcher.fetch).toHaveBeenCalledWith(
        expectedUrl,
        'GET',
        undefined,
        {},
      );
    });

    test('should throw on invalid baseUrl', async () => {
      expect(
        () =>
          new TestApiService({
            fetcher: mockFetcher,
            baseUrl: 'ht!tp://invalid-url',
          }),
      ).toThrow();
    });

    test('should pass default options to fetcher', async () => {
      const defaultOptions = { headers: { Authorization: 'Bearer token' } };
      const apiServiceWithDefaults = new TestApiService({
        fetcher: mockFetcher,
        defaultOptions,
      });
      const pathParams = { id: '123', detailId: '456' };
      const query = { verbose: true };
      const expectedUrl = '/test-endpoint/123/details/456?verbose=true';

      await apiServiceWithDefaults.get('/test-endpoint/:id/details/:detailId', {
        pathParams,
        query,
      });

      expect(mockFetcher.fetch).toHaveBeenCalledWith(
        expectedUrl,
        'GET',
        undefined,
        defaultOptions,
      );
    });
  });

  describe('try', () => {
    type TestEndpointWithPathParams = Endpoint<{
      method: 'GET';
      path: '/test-endpoint/:id/details/:detailId';
      query?: { verbose?: boolean };
      response: { data: string };
    }>;
    const mockFetcher = createMockFetcher();
    class TestApiService extends ApiService<TestEndpointWithPathParams> {}
    const apiService = new TestApiService({
      fetcher: mockFetcher,
    });

    test('should return response on success', async () => {
      const mockResponse = { data: 'test' };
      vi.spyOn(mockFetcher, 'fetch').mockResolvedValue(mockResponse);

      const result = await apiService.try('GET')(
        '/test-endpoint/:id/details/:detailId',
        {
          pathParams: { id: '123', detailId: '456' },
          query: { verbose: true },
        },
      );

      expect(result).toEqual([null, mockResponse]);
      expect(mockFetcher.fetch).toHaveBeenCalledWith(
        '/test-endpoint/123/details/456?verbose=true',
        'GET',
        undefined,
        {},
      );
    });

    test('should return error on failure', async () => {
      const mockError = new Error('Network error');
      vi.spyOn(mockFetcher, 'fetch').mockRejectedValue(mockError);

      const result = await apiService.try('GET')(
        '/test-endpoint/:id/details/:detailId',
        {
          pathParams: { id: '123', detailId: '456' },
          query: { verbose: true },
        },
      );

      expect(result).toEqual([mockError, null]);
      expect(mockFetcher.fetch).toHaveBeenCalledWith(
        '/test-endpoint/123/details/456?verbose=true',
        'GET',
        undefined,
        {},
      );
    });
  });
});

function createMockFetcher(): GenericFetcher {
  const fetcher: GenericFetcher = {
    fetch: vi.fn(),
  };
  return fetcher;
}
