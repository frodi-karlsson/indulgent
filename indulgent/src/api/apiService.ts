import type { UnknownObject } from '../types/object';
import type { WithoutEmptyObject } from '../types/util';
import { deepMerge } from '../util/object';
import { stringifyIfNotString } from '../util/json';

/**
 * Default fetcher implementation using the Fetch API.
 * It supports JSON responses and throws errors for non-2xx responses.
 *
 * For any reasonable customization, including base URL, you should provide your own fetcher implementation.
 * @see {@link GenericFetcher}
 */
export const defaultFetcher: GenericFetcher<RequestInit> = {
  fetch: async <ResponseData = unknown>(
    url: string,
    method: HttpMethod,
    body?: string,
    options?: RequestInit,
  ): Promise<ResponseData> => {
    const response = await fetch(url, { ...options, method, body });
    if (!response.ok) {
      throw new Error(
        `HTTP error! status: ${response.status}, statusText: ${response.statusText}`,
      );
    }
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return (await response.json()) as ResponseData;
    }
    return (await response.text()) as ResponseData;
  },
};

/**
 * Extracts the fetch options type from a GenericFetcher.
 */
type GetFetchOptionsFromFetcher<T extends GenericFetcher<Record<string, any>>> =
  T extends GenericFetcher<infer Options> ? Options : never;

/**
 * Generic API service, supporting type safety for endpoints, path params, query params and request/response bodies.
 *
 * Although it uses fetch in a very simple way beneath the hood, you can BYO fetch implementation by passing it in the constructor.
 * @see {@link defaultFetcher} for the default GenericFetcher implementation.
 *
 * @example
 * ```ts
 * import { ApiService, Endpoint } from "indulgent";
 *
 * // A GET endpoint with path param `id` and optional query param `q`, returning an object with `id` and `name`
 * type GetItem = Endpoint<{ method: "GET"; path: "/items/:id"; pathParams: { id: string }; query: { q?: string }; response: { id: string; name: string } }>;
 *
 * // A POST endpoint with no path params, accepting a JSON body with `name`, returning an object with `id` and `name`
 * type CreateItem = Endpoint<{ method: "POST"; path: "/items"; request: { name: string }; response: { id: string; name: string } }>;
 *
 * class MyApiService extends ApiService<GetItem | CreateItem> {}
 * const api = new MyApiService();
 *
 * // Making a GET request to /items/123?q=searchterm
 * const item = await api.get("/items/:id", { pathParams: { id: "123" }, query: { q: "searchterm" } });
 *
 * // Making a POST request to /items with JSON body { name: "NewItem" }
 * const newItem = await api.post("/items", { json: { name: "NewItem" } });
 * ```
 *
 * @see {@link Endpoint}
 *
 */
export abstract class ApiService<
  Endpoints extends BaseEndpoint<any, any, any, any, any>,
  Fetcher extends GenericFetcher = typeof defaultFetcher,
  OptionType extends
    GetFetchOptionsFromFetcher<Fetcher> = GetFetchOptionsFromFetcher<Fetcher>,
> implements IApi<Endpoints>
{
  private readonly fetcher: GenericFetcher<OptionType>;
  private readonly defaultOptions?: OptionType;
  constructor(opt?: {
    fetcher?: GenericFetcher<OptionType>;
    defaultOptions?: OptionType;
  }) {
    this.fetcher =
      opt?.fetcher || (defaultFetcher as GenericFetcher<OptionType>);
    this.defaultOptions = opt?.defaultOptions;
  }

  /**
   * Base fetch method, allowing to specify any HTTP method.
   *
   * @example
   * ```ts
   * const data = await api.fetch('/some-endpoint', { method: 'GET', pathParams: { id: '123' }, query: { q: 'search' } });
   * `
   */
  async fetch<E extends Endpoint<{}>>(
    url: E['path'],
    options: FetchOptionType<E>,
    fetchOptions?: Partial<OptionType>,
  ): Promise<E['response']> {
    const resolvedOptions = this.mergeOptionsWithDefaults(fetchOptions);
    const optionsBody = options?.['body'];
    let body: string | undefined;
    if (optionsBody !== undefined) {
      body = stringifyIfNotString(optionsBody);
    }

    return this.fetcher.fetch<E['response']>(
      this.resolveUrl(url, options?.['pathParams'], options?.['query']),
      options.method,
      body,
      resolvedOptions,
    );
  }

  /**
   * Makes a GET request to the specified endpoint.
   * @see {@link fetch} for the base method.
   *
   * @example
   * ```ts
   * const data = await api.get('/some-endpoint', { pathParams: { id: '123' }, query: { q: 'search' } });
   * ```
   */
  async get<Path extends Extract<Endpoints, { method: 'GET' }>['path']>(
    url: Path,
    options?: MethodFetchOptionType<
      Extract<Endpoints, { path: Path; method: 'GET' }>
    >,
    fetchOptions?: Partial<OptionType>,
  ): Promise<Extract<Endpoints, { path: Path; method: 'GET' }>['response']> {
    return this.fetch<Extract<Endpoints, { path: Path; method: 'GET' }>>(
      url,
      this.methodToFetchOptions({ ...options }, 'GET'),
      fetchOptions,
    );
  }

  /**
   * Makes a POST request to the specified endpoint.
   * @see {@link fetch} for the base method.
   *
   * @example
   * ```ts
   * const data = await api.post('/some-endpoint', { body: { key: 'value' } });
   * ```
   */
  async post<Path extends Extract<Endpoints, { method: 'POST' }>['path']>(
    url: Path,
    options?: MethodFetchOptionType<
      Extract<Endpoints, { method: 'POST'; path: Path }>
    >,
    fetchOptions?: Partial<OptionType>,
  ): Promise<Extract<Endpoints, { method: 'POST'; path: Path }>['response']> {
    return this.fetch<Extract<Endpoints, { method: 'POST'; path: Path }>>(
      url,
      this.methodToFetchOptions({ ...options }, 'POST'),
      fetchOptions,
    );
  }

  /**
   * Makes a PATCH request to the specified endpoint.
   * @see {@link fetch} for the base method.
   *
   * @example
   * ```ts
   * const data = await api.patch('/some-endpoint', { body: { key: 'value' } });
   * ```
   */
  async patch<Path extends Extract<Endpoints, { method: 'PATCH' }>['path']>(
    url: Path,
    options?: MethodFetchOptionType<
      Extract<Endpoints, { method: 'PATCH'; path: Path }>
    >,
    fetchOptions?: Partial<OptionType>,
  ): Promise<Extract<Endpoints, { method: 'PATCH'; path: Path }>['response']> {
    return this.fetch<Extract<Endpoints, { method: 'PATCH'; path: Path }>>(
      url,
      this.methodToFetchOptions({ ...options }, 'PATCH'),
      fetchOptions,
    );
  }

  /**
   * Makes a PUT request to the specified endpoint.
   * @see {@link fetch} for the base method.
   *
   * @example
   * ```ts
   * const data = await api.put('/some-endpoint', { body: { key: 'value' } });
   * ```
   */
  async put<Path extends Extract<Endpoints, { method: 'PUT' }>['path']>(
    url: Path,
    options?: MethodFetchOptionType<
      Extract<Endpoints, { method: 'PUT'; path: Path }>
    >,
    fetchOptions?: Partial<OptionType>,
  ): Promise<Extract<Endpoints, { method: 'PUT'; path: Path }>['response']> {
    return this.fetch<Extract<Endpoints, { method: 'PUT'; path: Path }>>(
      url,
      this.methodToFetchOptions({ ...options }, 'PUT'),
      fetchOptions,
    );
  }

  /**
   * Makes a DELETE request to the specified endpoint.
   * @see {@link fetch} for the base method.
   *
   * @example
   * ```ts
   * const data = await api.delete('/some-endpoint', { pathParams: { id: '123' } });
   * ```
   */
  async delete<Path extends Endpoint<{ method: 'DELETE' }>['path']>(
    url: Path,
    options?: MethodFetchOptionType<
      Extract<Endpoints, { method: 'DELETE'; path: Path }>
    >,
    fetchOptions?: Partial<OptionType>,
  ): Promise<Extract<Endpoints, { method: 'DELETE'; path: Path }>['response']> {
    return this.fetch<Extract<Endpoints, { method: 'DELETE'; path: Path }>>(
      url,
      this.methodToFetchOptions({ ...options }, 'DELETE'),
      fetchOptions,
    );
  }

  /**
   * Makes a HEAD request to the specified endpoint.
   * @see {@link fetch} for the base method.
   *
   * @example
   * ```ts
   * const data = await api.head('/some-endpoint', { pathParams: { id: '123' } });
   * ```
   */
  async head<Path extends Extract<Endpoints, { method: 'HEAD' }>['path']>(
    url: Path,
    options?: MethodFetchOptionType<
      Extract<Endpoints, { method: 'HEAD'; path: Path }>
    >,
    fetchOptions?: Partial<OptionType>,
  ): Promise<Extract<Endpoints, { method: 'HEAD'; path: Path }>['response']> {
    return this.fetch<Extract<Endpoints, { method: 'HEAD'; path: Path }>>(
      url,
      this.methodToFetchOptions({ ...options }, 'HEAD'),
      fetchOptions,
    );
  }

  private mergeOptionsWithDefaults(options?: Partial<OptionType>): OptionType {
    // we know this is safe because of the conditional type on the options parameter
    const resolved = { ...this.defaultOptions } as OptionType;
    if (options) {
      return deepMerge(resolved, options);
    }
    return resolved;
  }

  private resolvePathParams<Path extends string>(
    url: Path,
    pathParams: PathParams<Path> | unknown,
  ): string {
    let resolvedUrl: string = url;
    if (!pathParams) {
      return resolvedUrl;
    }
    for (const [key, value] of Object.entries(pathParams)) {
      resolvedUrl = resolvedUrl.replace(
        `:${String(key)}`,
        encodeURIComponent(String(value)),
      );
    }
    return resolvedUrl;
  }

  private resolveSearchParams(
    url: string,
    query: UnknownObject | unknown,
  ): string {
    if (!query || Object.keys(query).length === 0) {
      return url;
    }
    const urlObj = new URL(url, 'http://dummy-base'); // base is required but irrelevant here
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) {
        urlObj.searchParams.append(key, String(value));
      }
    }
    const queryString = urlObj.searchParams.toString();
    if (queryString) {
      return `${urlObj.pathname}?${queryString}`;
    }
    return urlObj.pathname;
  }

  private resolveUrl<Path extends string>(
    url: Path,
    pathParams: PathParams<Path> | unknown,
    query: UnknownObject | unknown,
  ): string {
    const urlWithPathParams = this.resolvePathParams(url, pathParams);
    return this.resolveSearchParams(urlWithPathParams, query);
  }

  private methodToFetchOptions<
    E extends Endpoint<{ method: Method }>,
    Method extends HttpMethod,
  >(
    methodFetchOptions: MethodFetchOptionType<E>,
    method: Method,
  ): FetchOptionType<E> {
    return {
      body: methodFetchOptions?.body,
      pathParams: methodFetchOptions?.pathParams,
      query: methodFetchOptions?.query,
      method: method,
    };
  }
}

/**
 * Suported HTTP methods for the ApiService.
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD';

/**
 * The type of the request body, either an object, undefined (no body), or never (no body allowed).
 */
export type Body = UnknownObject | never | undefined;

// an intersection of parameter objects based on `:${param}`s in the path, or {} if none
type PathParamsRec<Path extends string> =
  Path extends `${string}/:${infer Param}/${infer Rest}`
    ? { [K in Param]: string } & PathParamsRec<`/${Rest}`>
    : Path extends `${string}/:${infer Param}`
      ? { [K in Param]: string }
      : undefined;

type PathParams<Path extends string> =
  // here we clean out that {} case, substituting never
  PathParamsRec<Path> extends infer O
    ? WithoutEmptyObject<O> extends never
      ? never
      : O
    : never;

/**
 * Internal base interface representing the structure of an API endpoint.
 */
interface BaseEndpoint<
  Method extends HttpMethod,
  ResponseData,
  BodyData extends Body,
  SearchParams extends UnknownObject,
  Path extends string,
> {
  path: Path;
  method: Method;
  pathParams: [string] extends [Path] ? unknown : PathParams<Path>;
  query: SearchParams;
  response: ResponseData;
  body: BodyData;
}

/**
 * A type representing an API endpoint with method, path, request body, path parameters, query parameters, and response type.
 *
 * @example
 * ```ts
 * type GetUserEndpoint = Endpoint<{
 *   method: "GET";
 *   path: "/users/:id";
 *   response: User;
 *   pathParams: { id: string };
 *   query: { includePosts: boolean };
 * }>;
 * ```
 */
export interface Endpoint<
  T extends Partial<
    BaseEndpoint<HttpMethod, unknown, Body, UnknownObject, string>
  >,
> {
  method: T['method'] & HttpMethod;
  path: T['path'] & string;
  response: T['response'];
  body: T['body'];
  pathParams: T['pathParams'];
  query: T['query'];
}

/**
 * Passable options to the fetch method of ApiService, derived from the endpoint type.
 */
export type FetchOptionType<E extends Endpoint<{}>> = Pick<
  E,
  'pathParams' | 'query' | 'body' | 'method'
>;

/**
 * Passable options to the method-specific fetch methods of ApiService, derived from the endpoint type.
 */
type MethodFetchOptionType<E extends Endpoint<{}>> = Partial<
  Omit<FetchOptionType<E>, 'method'>
>;

interface MethodToMethodFetchFunctionName extends Record<HttpMethod, string> {
  GET: 'get';
  POST: 'post';
  PUT: 'put';
  DELETE: 'delete';
  PATCH: 'patch';
  HEAD: 'head';
}

/**
 * Internal interface representing the API methods available on ApiService.
 * Exists to make sure we don't leave any supported HTTP methods out of ApiService
 */
type IApi<Endpoints extends BaseEndpoint<any, any, any, any, any>> = {
  fetch: <ResponseData, Path extends string>(
    url: Path,
    options: FetchOptionType<Endpoints>,
  ) => Promise<ResponseData>;
} & {
  [Method in HttpMethod as MethodToMethodFetchFunctionName[Method]]: <
    ResponseData,
    Path extends (Endpoints & {
      method: Method;
    })['path'],
  >(
    url: Path,
    options: MethodFetchOptionType<Endpoints>,
  ) => Promise<ResponseData>;
};

/**
 * A generic interface for a fetcher function that can be used to make HTTP requests.
 *
 * @example
 * ```ts
 * const fetcher: GenericFetcher<{ headers: Record<string, string> }> = {
 *   fetch: async (url, method, body, options) => {
 *     const response = await fetch(url, { method, body, headers: options?.headers });
 *     if (!response.ok) {
 *       throw new Error(`HTTP error! status: ${response.status}`);
 *     }
 *     return response.json();
 *   },
 * };
 * ```
 */
export interface GenericFetcher<
  OptionType extends Record<string, any> = Record<string, any>,
> {
  fetch: <ResponseData = unknown>(
    url: string,
    method: HttpMethod,
    body?: string,
    options?: OptionType,
  ) => Promise<ResponseData>;
}
