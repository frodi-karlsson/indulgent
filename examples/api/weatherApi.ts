import { ApiService, type Endpoint } from 'indulgent/api';

type WeatherEndpoint = Endpoint<{
  method: 'GET';
  path: '/weather/:country/:city';
  query: {
    includeTime?: boolean;
  };
  response: {
    temperature: number;
    description: string;
    time?: string;
  };
}>;

type AliveEndpoint = Endpoint<{
  method: 'GET';
  path: '/alive';
  response: {
    status: 'ok';
  };
}>;

class WeatherApi extends ApiService<WeatherEndpoint | AliveEndpoint> {}

const weatherApi = new WeatherApi({
  baseUrl: 'https://api.example.com',
});

async function main(): Promise<void> {
  const londonWeather = await weatherApi.get('/weather/:country/:city', {
    query: { includeTime: true },
    pathParams: { city: '', country: '' },
  });

  console.log(
    `London Weather: ${londonWeather.temperature}°C, ${londonWeather.description}`,
  );

  const { status } = await weatherApi.get('/alive');
  console.log(`API Status: ${status}`);
}

main().catch((error) => {
  console.error('Error fetching weather data:', error);
});
