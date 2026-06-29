import { EventEmitter } from 'events';
import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import { runPgDumpToFile } from './backup-pg-dump.util';

jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));
jest.mock('fs/promises', () => ({
  copyFile: jest.fn().mockResolvedValue(undefined),
  unlink: jest.fn().mockResolvedValue(undefined),
}));

const spawnMock = spawn as jest.MockedFunction<typeof spawn>;
const copyFileMock = fs.copyFile as jest.MockedFunction<typeof fs.copyFile>;
const unlinkMock = fs.unlink as jest.MockedFunction<typeof fs.unlink>;

function mockSpawnExit(code: number, stderr = '') {
  const child = new EventEmitter() as EventEmitter & { stderr: EventEmitter };
  child.stderr = new EventEmitter();
  process.nextTick(() => {
    if (stderr) child.stderr.emit('data', Buffer.from(stderr));
    child.emit('close', code);
  });
  return child as never;
}

describe('runPgDumpToFile', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    copyFileMock.mockResolvedValue(undefined);
    unlinkMock.mockResolvedValue(undefined);
    process.env = {
      ...originalEnv,
      DATABASE_URL: 'postgresql://app_user:secret@localhost:5432/noorix',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('falls back to local postgres when app-user pg_dump fails on a local database', async () => {
    spawnMock
      .mockImplementationOnce(() => mockSpawnExit(1, 'pg_dump: error: permission denied for table audit_logs'))
      .mockImplementationOnce(() => mockSpawnExit(0));

    await expect(runPgDumpToFile('/tmp/noorix.dump')).resolves.toBeUndefined();

    expect(spawnMock).toHaveBeenNthCalledWith(
      1,
      'pg_dump',
      expect.arrayContaining(['-U', 'app_user', '-d', 'noorix', '-f', '/tmp/noorix.dump']),
      expect.objectContaining({
        env: expect.objectContaining({ PGPASSWORD: 'secret', PGSSLMODE: 'disable' }),
        stdio: ['ignore', 'pipe', 'pipe'],
      }),
    );
    expect(spawnMock).toHaveBeenNthCalledWith(
      2,
      'runuser',
      expect.arrayContaining(['-u', 'postgres', '--', 'pg_dump', '-d', 'noorix']),
      expect.objectContaining({
        env: expect.objectContaining({ PGSSLMODE: 'disable' }),
        stdio: ['ignore', 'pipe', 'pipe'],
      }),
    );
    const fallbackArgs = spawnMock.mock.calls[1][1] as string[];
    const fallbackOutPath = fallbackArgs[fallbackArgs.indexOf('-f') + 1];
    expect(fallbackOutPath).toMatch(/noorix-pg-dump-postgres-.*\.dump$/);
    expect(fallbackOutPath).not.toBe('/tmp/noorix.dump');
    expect(copyFileMock).toHaveBeenCalledWith(fallbackOutPath, '/tmp/noorix.dump');
    expect(unlinkMock).toHaveBeenCalledWith(fallbackOutPath);
  });

  it('reports both primary and local fallback errors when both fail', async () => {
    spawnMock
      .mockImplementationOnce(() => mockSpawnExit(1, 'primary failed'))
      .mockImplementationOnce(() => mockSpawnExit(1, 'fallback failed'));

    await expect(runPgDumpToFile('/tmp/noorix.dump')).rejects.toThrow(
      /فشل pg_dump بمستخدم التطبيق: primary failed[\s\S]*فشل fallback المحلي عبر postgres: fallback failed/,
    );
  });
});
