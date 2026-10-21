const publicTestMode = bool.fromEnvironment('DT_PUBLIC_TEST');
const simulationRelease = bool.fromEnvironment('DT_SIMULATION_RELEASE');
const publicTestApi = 'https://dtexchange.app/test-api/api/v1';
const publicTestLabel = 'SIMULATION — NO REAL USDT OR INR';

bool isPublicTestApiRequest(Uri uri) =>
    uri.scheme == 'https' &&
    uri.host == 'dtexchange.app' &&
    uri.port == 443 &&
    uri.userInfo.isEmpty &&
    (uri.path == '/test-api/api/v1' ||
        uri.path.startsWith('/test-api/api/v1/')) &&
    !uri.pathSegments.any((part) => part == '..' || part == '.');
