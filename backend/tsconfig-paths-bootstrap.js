const tsConfigPaths = require('tsconfig-paths');

// Register path mapping
tsConfigPaths.register({
  baseUrl: './dist',
  paths: {
    '@/*': ['./*'],
    '@/config/*': ['./config/*'],
    '@/controllers/*': ['./controllers/*'],
    '@/services/*': ['./services/*'],
    '@/models/*': ['./models/*'],
    '@/routes/*': ['./routes/*'],
    '@/middleware/*': ['./middleware/*'],
    '@/utils/*': ['./utils/*'],
    '@/types/*': ['./types/*']
  }
});