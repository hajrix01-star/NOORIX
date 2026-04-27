import { BadRequestException } from '@nestjs/common';

export function parseDatabaseUrl(dbUrl: string): {
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
} {
  let u: URL;
  try {
    u = new URL(dbUrl.replace(/^postgresql:/i, 'http:'));
  } catch {
    throw new BadRequestException('DATABASE_URL غير صالح');
  }
  const database = (u.pathname || '/postgres').replace(/^\//, '').split('?')[0] || 'postgres';
  return {
    host: u.hostname,
    port: u.port || '5432',
    user: decodeURIComponent(u.username || 'postgres'),
    password: decodeURIComponent(u.password || ''),
    database,
  };
}
