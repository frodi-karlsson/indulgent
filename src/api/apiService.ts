import type { UnknownObject } from '../types/object';
import type { WithoutEmptyObject } from '../types/util';
import { deepMerge } from '../util/object';
import { stringifyIfNotString } from '../util/json';

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
 * type GetItem = Endpoint<{ method: "GET"; path: "/items/:id"; pathParams: { id: string }; searchParams: { q?: string }; response: { id: string; name: string } }>;
 *
 * // A POST endpoint with no path params, accepting a JSON body with `name`, returning an object with `id` and `name`
 * type CreateItem = Endpoint<{ method: "POST"; path: "/items"; request: { name: string }; response: { id: string; name: string } }>;
 *
 * class MyApiService extends ApiService<GetItem | CreateItem> {}
 * const api = new MyApiService();
 *
 * // Making a GET request to /items/123?q=searchterm
 * const item = await api.get("/items/:id", { pathParams: { id: "123" }, searchParams: { q: "searchterm" } });
 *
 * // Making a POST request to /items with JSON body { name: "NewItem" }
 * const newItem = await api.post("/items", { json: { name: "NewItem" } });
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
    searchParams: UnknownObject | unknown,
  ): string {
    if (!searchParams || Object.keys(searchParams).length === 0) {
      return url;
    }
    const urlObj = new URL(url, 'http://dummy-base'); // base is required but irrelevant here
    for (const [key, value] of Object.entries(searchParams)) {
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
    searchParams: UnknownObject | unknown,
  ): string {
    const urlWithPathParams = this.resolvePathParams(url, pathParams);
    return this.resolveSearchParams(urlWithPathParams, searchParams);
  }

  async fetch<ResponseData, E extends Endpoint<{}>>(
    url: E['path'],
    options: FetchOptionType<E>,
    fetchOptions?: Partial<OptionType>,
  ): Promise<ResponseData> {
    const resolvedOptions = this.mergeOptionsWithDefaults(fetchOptions);
    const optionsBody = options?.['body'];
    let body: string | undefined;
    if (optionsBody !== undefined) {
      body = stringifyIfNotString(optionsBody);
    }

    return this.fetcher.fetch<ResponseData>(
      this.resolveUrl(url, options?.['pathParams'], options?.['searchParams']),
      options.method,
      body,
      resolvedOptions,
    );
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
      searchParams: methodFetchOptions?.searchParams,
      method: method,
    };
  }

  async get<ResponseData, Path extends (Endpoints & { method: 'GET' })['path']>(
    url: Path,
    options?: MethodFetchOptionType<Endpoints & { method: 'GET'; path: Path }>,
    fetchOptions?: Partial<OptionType>,
  ): Promise<ResponseData> {
    return this.fetch<ResponseData, Endpoints & { method: 'GET'; path: Path }>(
      url,
      this.methodToFetchOptions({ ...options }, 'GET'),
      fetchOptions,
    );
  }

  async post<
    ResponseData,
    Path extends (Endpoints & { method: 'POST' })['path'],
  >(
    url: Path,
    options?: MethodFetchOptionType<Endpoints & { method: 'POST'; path: Path }>,
    fetchOptions?: Partial<OptionType>,
  ): Promise<ResponseData> {
    return this.fetch<ResponseData, Endpoints & { method: 'POST'; path: Path }>(
      url,
      this.methodToFetchOptions({ ...options }, 'POST'),
      fetchOptions,
    );
  }

  async patch<
    ResponseData,
    Path extends (Endpoints & { method: 'PATCH' })['path'],
  >(
    url: Path,
    options?: MethodFetchOptionType<
      Endpoints & { method: 'PATCH'; path: Path }
    >,
    fetchOptions?: Partial<OptionType>,
  ): Promise<ResponseData> {
    return this.fetch<
      ResponseData,
      Endpoints & { method: 'PATCH'; path: Path }
    >(url, this.methodToFetchOptions({ ...options }, 'PATCH'), fetchOptions);
  }

  async put<ResponseData, Path extends (Endpoints & { method: 'PUT' })['path']>(
    url: Path,
    options?: MethodFetchOptionType<Endpoints & { method: 'PUT'; path: Path }>,
    fetchOptions?: Partial<OptionType>,
  ): Promise<ResponseData> {
    return this.fetch<ResponseData, Endpoints & { method: 'PUT'; path: Path }>(
      url,
      this.methodToFetchOptions({ ...options }, 'PUT'),
      fetchOptions,
    );
  }

  async delete<
    ResponseData,
    Path extends Endpoint<{ method: 'DELETE' }>['path'],
  >(
    url: Path,
    options?: MethodFetchOptionType<
      Endpoints & { method: 'DELETE'; path: Path }
    >,
    fetchOptions?: Partial<OptionType>,
  ): Promise<ResponseData> {
    return this.fetch<
      ResponseData,
      Endpoints & { method: 'DELETE'; path: Path }
    >(url, this.methodToFetchOptions({ ...options }, 'DELETE'), fetchOptions);
  }
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD';

type BodyRestriction = UnknownObject | never | undefined;

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

interface BaseEndpoint<
  Method extends HttpMethod,
  ResponseData,
  BodyData extends BodyRestriction,
  SearchParams extends UnknownObject,
  Path extends string,
> {
  path: Path;
  method: Method;
  pathParams: [string] extends [Path] ? unknown : PathParams<Path>;
  searchParams: SearchParams;
  response: ResponseData;
  body: BodyData;
}

export interface Endpoint<
  T extends Partial<
    BaseEndpoint<HttpMethod, unknown, BodyRestriction, UnknownObject, string>
  >,
> {
  method: T['method'] & HttpMethod;
  path: T['path'] & string;
  response: T['response'];
  body: T['body'];
  pathParams: T['pathParams'];
  searchParams: T['searchParams'];
}

export type FetchOptionType<E extends Endpoint<{}>> = Pick<
  E,
  'pathParams' | 'searchParams' | 'body' | 'method'
>;

export type MethodFetchOptionType<E extends Endpoint<{}>> = Partial<
  Omit<FetchOptionType<E>, 'method'>
>;

export type IApi<Endpoints extends BaseEndpoint<any, any, any, any, any>> = {
  fetch: <ResponseData, Path extends string>(
    url: Path,
    options: FetchOptionType<Endpoints>,
  ) => Promise<ResponseData>;
} & {
  [Method in HttpMethod as Method extends 'GET'
    ? 'get'
    : Method extends 'POST'
      ? 'post'
      : Method extends 'PUT'
        ? 'put'
        : Method extends 'DELETE'
          ? 'delete'
          : never]: <ResponseData, Path extends string>(
    url: Path,
    options: MethodFetchOptionType<Endpoints>,
  ) => Promise<ResponseData>;
};

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

const weatherFetcher: GenericFetcher<RequestInit> = {
  fetch: async <ResponseData = unknown>(
    url: string,
    method: HttpMethod,
    body?: string,
    options?: RequestInit,
  ): Promise<ResponseData> => {
    const response = await fetch(`https://api.weatherapi.com/v1${url}`, {
      ...options,
      method,
      body,
    });
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

type WeatherEndpoint = Endpoint<{
  method: 'GET';
  path: '/current/:id';
  pathParams: { id: string };
  searchParams: { q: string; days?: number };
  response: { location: unknown; current: unknown; forecast?: unknown };
}>;

type WeatherAliveEndpoint = Endpoint<{
  method: 'GET';
  path: '/alive';
  response: { status: 'alive' };
}>;

export class WeatherApiService extends ApiService<
  WeatherEndpoint | WeatherAliveEndpoint,
  typeof weatherFetcher
> {}
