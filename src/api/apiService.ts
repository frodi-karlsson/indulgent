import type { CurlyLips, UnknownObject } from '../types/object';
import type { WithoutEmptyObject } from '../types/util';
import { stringifyIfNotString } from '../util/json';
import { deepMerge } from '../util/object';

export const defaultFetcher: GenericFetcher<RequestInit> = {
  get: async (url, options) => {
    return await fetch(url, options).then((res) => res.json());
  },
  post: async (url, options) => {
    return await fetch(url, { ...options, method: 'POST' }).then((res) =>
      res.json(),
    );
  },
  put: async (url, options) => {
    return await fetch(url, { ...options, method: 'PUT' }).then((res) =>
      res.json(),
    );
  },
  patch: async (url, options) => {
    return await fetch(url, { ...options, method: 'PATCH' }).then((res) =>
      res.json(),
    );
  },
  delete: async (url, options) => {
    return await fetch(url, { ...options, method: 'DELETE' }).then((res) =>
      res.json(),
    );
  },
};

type GetFetchOptionsFromFetcher<T extends GenericFetcher<UnknownObject>> =
  T extends GenericFetcher<infer Options> ? Options : Record<string, unknown>;

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
 * type GetItem = Endpoint.Get<"/items/:id", { q?: string }, { id: string; name: string }>;
 *
 * // A POST endpoint with no path params, accepting a JSON body with `name`, returning an object with `id` and `name`
 * type CreateItem = Endpoint.Post<"/items", { name: string }, { id: string; name: string }>;
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
  // oxlint-disable-next-line no-explicit-any
  Endpoints extends BaseEndpoint<any, any, any, any, any>,
  Fetcher extends GenericFetcher = typeof defaultFetcher,
  OptionType extends
    GetFetchOptionsFromFetcher<Fetcher> = GetFetchOptionsFromFetcher<Fetcher>,
> implements IApi<Endpoints, OptionType>
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

  private mergeOptionsWithDefaults<
    T extends FetchOptionType<string, Endpoints, OptionType>,
  >(options: T | undefined): T {
    const resolved: T = { ...this.defaultOptions } as T;
    return options ? deepMerge(resolved, options) : resolved;
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
    return queryString ? `${urlObj.pathname}?${queryString}` : urlObj.pathname;
  }

  private resolveUrl<Path extends string>(
    url: Path,
    pathParams: PathParams<Path> | unknown,
    searchParams: UnknownObject | unknown,
  ): string {
    const urlWithPathParams = this.resolvePathParams(url, pathParams);
    return this.resolveSearchParams(urlWithPathParams, searchParams);
  }

  private cleanOptions<T extends UnknownObject>(options: T): T {
    const cleaned = { ...options };
    delete cleaned['pathParams'];
    delete cleaned['searchParams'];
    delete cleaned['body'];
    return cleaned;
  }

  get: IApi<Endpoints, OptionType>['get'] = async (url, options) => {
    const resolvedOptions = this.mergeOptionsWithDefaults(options);
    return await this.fetcher.get(
      this.resolveUrl(
        url,
        resolvedOptions['pathParams'],
        resolvedOptions['searchParams'],
      ),
      this.cleanOptions(resolvedOptions),
    );
  };

  post: IApi<Endpoints, OptionType>['post'] = async (url, options) => {
    const resolvedOptions = this.mergeOptionsWithDefaults(options);
    const optionsBody = resolvedOptions['body'];
    const body = optionsBody ? stringifyIfNotString(optionsBody) : undefined;
    return await this.fetcher.post(
      this.resolveUrl(
        url,
        resolvedOptions['pathParams'],
        resolvedOptions['searchParams'],
      ),
      Object.assign({}, this.cleanOptions(resolvedOptions), { body }),
    );
  };

  put: IApi<Endpoints, OptionType>['put'] = async (url, options) => {
    const resolvedOptions = this.mergeOptionsWithDefaults(options);
    const optionsBody = resolvedOptions['body'];
    const body = optionsBody ? stringifyIfNotString(optionsBody) : undefined;
    return await this.fetcher.put(
      this.resolveUrl(
        url,
        resolvedOptions['pathParams'],
        resolvedOptions['searchParams'],
      ),
      Object.assign({}, this.cleanOptions(resolvedOptions), { body }),
    );
  };

  patch: IApi<Endpoints, OptionType>['patch'] = async (url, options) => {
    const resolvedOptions = this.mergeOptionsWithDefaults(options);
    const optionsBody = resolvedOptions['body'];
    const body = optionsBody ? stringifyIfNotString(optionsBody) : undefined;
    return await this.fetcher.patch(
      this.resolveUrl(
        url,
        resolvedOptions['pathParams'],
        resolvedOptions['searchParams'],
      ),
      Object.assign({}, this.cleanOptions(resolvedOptions), { body }),
    );
  };

  delete: IApi<Endpoints, OptionType>['delete'] = async (url, options) => {
    const resolvedOptions = this.mergeOptionsWithDefaults(options);
    const optionsBody = resolvedOptions['body'];
    const body = optionsBody ? stringifyIfNotString(optionsBody) : undefined;
    return await this.fetcher.delete(
      this.resolveUrl(
        url,
        resolvedOptions['pathParams'],
        resolvedOptions['searchParams'],
      ),
      Object.assign({}, this.cleanOptions(resolvedOptions), { body }),
    );
  };
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD';

type BodyRestriction = UnknownObject | never | undefined;

// an intersection of parameter objects based on `:${param}`s in the path, or {} if none
type PathParamsRec<Path extends string> =
  Path extends `${string}/:${infer Param}/${infer Rest}`
    ? { [K in Param]: string } & PathParamsRec<`/${Rest}`>
    : Path extends `${string}/:${infer Param}`
      ? { [K in Param]: string }
      : CurlyLips;

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
  searchParams?: SearchParams;
  response: ResponseData;
  body: BodyData;
}

type DefaultEndpoint = BaseEndpoint<
  HttpMethod,
  unknown,
  BodyRestriction,
  UnknownObject,
  string
>;

export type FetchOptionType<
  Path extends string,
  Endpoint extends BaseEndpoint<
    HttpMethod,
    unknown,
    BodyRestriction,
    UnknownObject,
    Path
  >,
  OptionType extends UnknownObject,
> = WithoutProprietaryProperties<OptionType> &
  (PathParams<Path> extends never ? {} : { pathParams: PathParams<Path> }) &
  (Endpoint['searchParams'] extends never
    ? {}
    : { searchParams?: Endpoint['searchParams'] }) &
  (Endpoint['body'] extends never ? {} : { body: Endpoint['body'] });

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Endpoint {
  export type Get<
    Path extends string,
    SearchParams extends UnknownObject,
    ResponseData,
  > = BaseEndpoint<'GET', ResponseData, never, SearchParams, Path>;

  export type Post<
    Path extends string,
    BodyData extends BodyRestriction,
    ResponseData,
  > = BaseEndpoint<'POST', ResponseData, BodyData, never, Path>;

  export type Put<
    Path extends string,
    BodyData extends BodyRestriction,
    ResponseData,
  > = BaseEndpoint<'PUT', ResponseData, BodyData, never, Path>;

  export type Patch<
    Path extends string,
    BodyData extends BodyRestriction,
    ResponseData,
  > = BaseEndpoint<'PATCH', ResponseData, BodyData, never, Path>;

  export type Delete<
    Path extends string,
    BodyData extends BodyRestriction,
    ResponseData,
  > = BaseEndpoint<'DELETE', ResponseData, BodyData, never, Path>;
}

type FilterEndpointsByMethod<
  Endpoints extends DefaultEndpoint,
  Method extends HttpMethod,
> =
  Endpoints extends BaseEndpoint<
    Method,
    unknown,
    BodyRestriction,
    UnknownObject,
    infer Path
  >
    ? BaseEndpoint<Method, unknown, BodyRestriction, UnknownObject, Path>
    : never;

export interface IApi<
  Endpoints extends DefaultEndpoint,
  FetchOptions extends UnknownObject = UnknownObject,
> {
  get: <Path extends FilterEndpointsByMethod<Endpoints, 'GET'>['path']>(
    url: Path,
    options?: FetchOptionType<
      Path,
      FilterEndpointsByPath<Endpoints, Path>,
      FetchOptions
    >,
  ) => Promise<FilterEndpointsByPath<Endpoints, Path>['response']>;

  post: <Path extends FilterEndpointsByMethod<Endpoints, 'POST'>['path']>(
    url: Path,
    options?: FetchOptionType<
      Path,
      FilterEndpointsByPath<Endpoints, Path>,
      FetchOptions
    >,
  ) => Promise<FilterEndpointsByPath<Endpoints, Path>['response']>;

  put: <Path extends FilterEndpointsByMethod<Endpoints, 'PUT'>['path']>(
    url: Path,
    options?: FetchOptionType<
      Path,
      FilterEndpointsByPath<Endpoints, Path>,
      FetchOptions
    >,
  ) => Promise<FilterEndpointsByPath<Endpoints, Path>['response']>;

  patch: <Path extends FilterEndpointsByMethod<Endpoints, 'PATCH'>['path']>(
    url: Path,
    options?: FetchOptionType<
      Path,
      FilterEndpointsByPath<Endpoints, Path>,
      FetchOptions
    >,
  ) => Promise<FilterEndpointsByPath<Endpoints, Path>['response']>;

  delete: <Path extends FilterEndpointsByMethod<Endpoints, 'DELETE'>['path']>(
    url: Path,
    options?: FetchOptionType<
      Path,
      FilterEndpointsByPath<Endpoints, Path>,
      FetchOptions
    >,
  ) => Promise<FilterEndpointsByPath<Endpoints, Path>['response']>;
}

type WithoutProprietaryProperties<T extends UnknownObject> = Omit<
  T,
  'pathParams' | 'searchParams' | 'body'
>;

export interface GenericFetcher<
  // oxlint-disable-next-line no-explicit-any
  OptionType extends Record<string, any> = Record<string, any>,
> {
  get: <ResponseData = unknown>(
    url: string,
    options?: Partial<WithoutProprietaryProperties<OptionType>>,
  ) => Promise<ResponseData>;
  post: <ResponseData = unknown>(
    url: string,
    options?: Partial<WithoutProprietaryProperties<OptionType>>,
  ) => Promise<ResponseData>;
  put: <ResponseData = unknown>(
    url: string,
    options?: Partial<WithoutProprietaryProperties<OptionType>>,
  ) => Promise<ResponseData>;
  patch: <ResponseData = unknown>(
    url: string,
    options?: Partial<WithoutProprietaryProperties<OptionType>>,
  ) => Promise<ResponseData>;
  delete: <ResponseData = unknown>(
    url: string,
    options?: Partial<WithoutProprietaryProperties<OptionType>>,
  ) => Promise<ResponseData>;
}

type FilterEndpointsByPath<
  Endpoints extends BaseEndpoint<
    HttpMethod,
    unknown,
    BodyRestriction,
    UnknownObject,
    string
  >,
  Path extends string,
> =
  Endpoints extends BaseEndpoint<
    HttpMethod,
    unknown,
    BodyRestriction | never,
    UnknownObject,
    Path
  >
    ? Endpoints & { path: Path }
    : never;
