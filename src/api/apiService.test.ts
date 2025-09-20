import { ApiService, type Endpoint, type GenericFetcher } from './apiService';
import { describe, expect, test, vi } from 'vitest';
import type { UnknownObject } from '../types/object';

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
          searchParams: params,
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
});

describe('With path parameters', () => {
  type TestEndpointWithPathParams = Endpoint<{
    method: 'GET';
    path: '/test-endpoint/:id/details/:detailId';
    query?: { verbose?: boolean };
    response: UnknownObject;
  }>;

  const testCasesGetWithPathParams: {
    pathParams: { id: string; detailId: string };
    searchParams?: { verbose?: boolean };
    expectedUrl: string;
    description: string;
  }[] = [
    {
      description: 'with path params, no query params',
      pathParams: { id: '123', detailId: '456' },
      searchParams: undefined,
      expectedUrl: '/test-endpoint/123/details/456',
    },
    {
      description: 'with path params and query params',
      pathParams: { id: '123', detailId: '456' },
      searchParams: { verbose: true },
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
      const { pathParams, searchParams, expectedUrl } = testCase;

      await apiService.get('/test-endpoint/:id/details/:detailId', {
        pathParams,
        searchParams,
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

function createMockFetcher(): GenericFetcher {
  const fetcher: GenericFetcher = {
    fetch: vi.fn(),
  };
  return fetcher;
}
