import { describe, expect, test, vi } from 'vitest';
import type { Endpoint, FetchOptionType, GenericFetcher } from './apiService';
import { ApiService } from './apiService';
import { UnknownObject } from '../types/object';

describe('ApiService', () => {
  describe('get method with query parameters', () => {
    type TestGetEndpoint = Endpoint.Get<
      '/test-endpoint',
      {
        search?: string;
        page?: number;
      },
      UnknownObject
    >;

    const testCasesGetWithQuery: {
      params?: Record<string, string | number>;
      expectedUrl: string;
      expectedOptions: {
        body: string | undefined;
      };
      description: string;
    }[] = [
      {
        description: 'no params, no data',
        params: undefined,
        expectedUrl: '/test-endpoint',
        expectedOptions: {
          body: undefined,
        },
      },
      {
        description: 'with params, no data',
        params: { search: 'query', page: 2 },
        expectedUrl: '/test-endpoint?search=query&page=2',
        expectedOptions: {
          body: undefined,
        },
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
        const { params, expectedUrl, expectedOptions } = testCase;

        await apiService.get('/test-endpoint', {
          searchParams: params,
        });

        expect(mockFetcher.get).toHaveBeenCalledWith(
          expectedUrl,
          expectedOptions,
        );
      },
    );
  });

  describe('post method with body', () => {
    type TestPostEndpoint = Endpoint.Post<
      '/test-endpoint',
      { a: string; b: number } | undefined,
      { c: boolean }
    >;

    const testCasesPostWithBody: {
      body?: { a: string; b: number };
      expectedOptions: {
        body: string | undefined;
      };
      description: string;
    }[] = [
      {
        description: 'no body',
        body: undefined,
        expectedOptions: {
          body: undefined,
        },
      },
      {
        description: 'with body as object',
        body: { a: 'value', b: 42 },
        expectedOptions: {
          body: JSON.stringify({ a: 'value', b: 42 }),
        },
      },
      {
        description: 'with body as string',
        body: '{"a":"value","b":42}' as unknown as { a: string; b: number },
        expectedOptions: {
          body: '{"a":"value","b":42}',
        },
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
        const { body, expectedOptions } = testCase;

        await apiService.post('/test-endpoint', {
          body,
        });

        expect(mockFetcher.post).toHaveBeenCalledWith(
          '/test-endpoint',
          expectedOptions,
        );
      },
    );
  });

  describe('put method with body', () => {
    type TestPutEndpoint = Endpoint.Put<
      '/test-endpoint',
      { a: string; b: number } | undefined,
      { c: boolean }
    >;

    const testCasesPutWithBody: {
      body?: { a: string; b: number };
      expectedOptions: {
        body: string | undefined;
      };
      description: string;
    }[] = [
      {
        description: 'no body',
        body: undefined,
        expectedOptions: {
          body: undefined,
        },
      },
      {
        description: 'with body as object',
        body: { a: 'value', b: 42 },
        expectedOptions: {
          body: JSON.stringify({ a: 'value', b: 42 }),
        },
      },
      {
        description: 'with body as string',
        body: '{"a":"value","b":42}' as unknown as { a: string; b: number },
        expectedOptions: {
          body: '{"a":"value","b":42}',
        },
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
        const { body, expectedOptions } = testCase;

        await apiService.put('/test-endpoint', {
          body,
        });

        expect(mockFetcher.put).toHaveBeenCalledWith(
          '/test-endpoint',
          expectedOptions,
        );
      },
    );
  });

  describe('delete method with body', () => {
    type TestDeleteEndpoint = Endpoint.Delete<
      '/test-endpoint',
      { a: string; b: number } | undefined,
      { c: boolean }
    >;

    const testCasesDeleteWithBody: {
      body?: { a: string; b: number };
      expectedOptions: {
        body: string | undefined;
      };
      description: string;
    }[] = [
      {
        description: 'no body',
        body: undefined,
        expectedOptions: {
          body: undefined,
        },
      },
      {
        description: 'with body as object',
        body: { a: 'value', b: 42 },
        expectedOptions: {
          body: JSON.stringify({ a: 'value', b: 42 }),
        },
      },
      {
        description: 'with body as string',
        body: '{"a":"value","b":42}' as unknown as { a: string; b: number },
        expectedOptions: {
          body: '{"a":"value","b":42}',
        },
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
        const { body, expectedOptions } = testCase;

        await apiService.delete('/test-endpoint', {
          body,
        });

        expect(mockFetcher.delete).toHaveBeenCalledWith(
          '/test-endpoint',
          expectedOptions,
        );
      },
    );
  });
});

describe('With path parameters', () => {
  type TestEndpointWithPathParams = Endpoint.Get<
    '/test-endpoint/:id/details/:detailId',
    { verbose?: boolean },
    UnknownObject
  >;

  const testCasesGetWithPathParams: {
    pathParams: { id: string; detailId: string };
    searchParams?: { verbose?: boolean };
    expectedUrl: string;
    expectedOptions: {
      body: string | undefined;
    };
    description: string;
  }[] = [
    {
      description: 'with path params, no query params',
      pathParams: { id: '123', detailId: '456' },
      searchParams: undefined,
      expectedUrl: '/test-endpoint/123/details/456',
      expectedOptions: {
        body: undefined,
      },
    },
    {
      description: 'with path params and query params',
      pathParams: { id: '123', detailId: '456' },
      searchParams: { verbose: true },
      expectedUrl: '/test-endpoint/123/details/456?verbose=true',
      expectedOptions: {
        body: undefined,
      },
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
      const { pathParams, searchParams, expectedUrl, expectedOptions } =
        testCase;

      await apiService.get('/test-endpoint/:id/details/:detailId', {
        pathParams,
        searchParams,
      });

      expect(mockFetcher.get).toHaveBeenCalledWith(
        expectedUrl,
        expectedOptions,
      );
    },
  );
});

function createMockFetcher(): GenericFetcher {
  const fetcher: GenericFetcher = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
  };
  return fetcher;
}
