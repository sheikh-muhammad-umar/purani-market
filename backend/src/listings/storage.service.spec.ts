import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { StorageService } from './storage.service';

/**
 * Covers the boundary that keeps uploads inside the upload directory.
 *
 * The folder is caller-supplied — one segment of the chat path comes from a URL
 * parameter — so this is a trust boundary rather than a formality.
 */
describe('StorageService', () => {
  let service: StorageService;
  let cwd: string;
  let originalCwd: string;

  beforeEach(async () => {
    // Runs in a scratch directory so the real uploads tree is never touched.
    cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'storage-spec-'));
    originalCwd = process.cwd();
    process.chdir(cwd);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        { provide: ConfigService, useValue: { get: () => 3000 } },
      ],
    }).compile();

    service = module.get(StorageService);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(cwd, { recursive: true, force: true });
  });

  it('stores a file under the requested folder', async () => {
    const result = await service.saveFile(
      'listings/abc',
      'photo.jpg',
      Buffer.from('x'),
    );

    expect(result.key).toMatch(/^listings\/abc\/[0-9a-f-]{36}-photo\.jpg$/);
    expect(fs.existsSync(path.join(cwd, 'uploads', result.key))).toBe(true);
  });

  it('strips path separators out of the filename', async () => {
    const result = await service.saveFile(
      'listings',
      '../../escape.jpg',
      Buffer.from('x'),
    );

    // Separators become underscores, so what is left is a flat filename. Dots
    // survive and are harmless once they cannot be followed by a separator.
    const [folder, ...rest] = result.key.split('/');
    expect(folder).toBe('listings');
    expect(rest).toHaveLength(1);
    expect(fs.existsSync(path.join(cwd, 'uploads', result.key))).toBe(true);
  });

  it('refuses a folder that climbs out of the upload directory', async () => {
    await expect(
      service.saveFile('../../../etc', 'passwd', Buffer.from('x')),
    ).rejects.toThrow('Invalid upload path');
  });

  it('refuses a sibling directory that merely shares the prefix', async () => {
    // `startsWith` alone accepted this: `<cwd>/uploads_public` begins with
    // `<cwd>/uploads`, so the old guard let writes land outside the tree.
    await expect(
      service.saveFile('../uploads_public', 'x.jpg', Buffer.from('x')),
    ).rejects.toThrow('Invalid upload path');
  });

  it('ignores a delete that points outside the upload directory', async () => {
    const outside = path.join(cwd, 'secret.txt');
    fs.writeFileSync(outside, 'keep me');

    await service.deleteFile('../secret.txt');

    expect(fs.existsSync(outside)).toBe(true);
  });

  it('deletes a file that is genuinely inside', async () => {
    const saved = await service.saveFile('x', 'y.jpg', Buffer.from('x'));

    await service.deleteFile(saved.key);

    expect(fs.existsSync(path.join(cwd, 'uploads', saved.key))).toBe(false);
  });
});
