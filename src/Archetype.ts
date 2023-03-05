import { join, dirname } from "node:path";
import { promisify } from "node:util";
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import { glob as _glob } from "glob";
import recursiveCopy from "recursive-copy";
import { render, Data } from "ejs";

const glob = promisify(_glob);

const allFilesGlob = join("**", "*");

const staticDirectoryName = "static";
const templateDirectoryName = "templates";

export type ArchetypeSettings = Readonly<{
  sourceDirectory: string;
}>;

export type ReificationSettings<TMetadata extends Data> = Readonly<{
  targetDirectory: string;
  metadata?: TMetadata;
  encoding?: BufferEncoding;
}>;

type MetadataInjectionSettings<TMetadata extends Data> = Readonly<{
  targetDirectory: string;
  metadata?: TMetadata;
  encoding: BufferEncoding;
}>;

export class Archetype<TMetadata extends Data> {
  private readonly sourceDirectory: string;

  constructor({ sourceDirectory }: ArchetypeSettings) {
    this.sourceDirectory = sourceDirectory;
  }

  async reify({
    targetDirectory,
    metadata,
    encoding
  }: ReificationSettings<TMetadata>): Promise<void> {
    await this.verifySourceDirectory();

    await this.ensureTargetDirectory(targetDirectory);

    await Promise.all([
      this.copyStaticFiles(targetDirectory),
      this.injectMetadata({
        targetDirectory,
        metadata,
        encoding: encoding ?? "utf8"
      })
    ]);
  }

  private async verifySourceDirectory(): Promise<void> {
    try {
      await access(this.sourceDirectory);
    } catch {
      throw new Error(
        `The source directory does not exist: '${this.sourceDirectory}'`
      );
    }
  }

  private async ensureTargetDirectory(targetDirectory: string): Promise<void> {
    await mkdir(targetDirectory, { recursive: true });
  }

  private async copyStaticFiles(targetDirectory: string): Promise<void> {
    const staticDirectory = join(this.sourceDirectory, staticDirectoryName);

    try {
      await access(staticDirectory);
    } catch {
      return;
    }

    await recursiveCopy(staticDirectory, targetDirectory, {
      dot: true,
      overwrite: true
    });
  }

  private async injectMetadata({
    targetDirectory,
    metadata,
    encoding
  }: MetadataInjectionSettings<TMetadata>): Promise<void> {
    const templateDirectory = join(this.sourceDirectory, templateDirectoryName);

    const relativeTemplatePaths = await glob(allFilesGlob, {
      cwd: templateDirectory,
      dot: true,
      nodir: true
    });

    const parallelTemplatePromises = relativeTemplatePaths.map(
      async relativePath => {
        const templatePath = join(templateDirectory, relativePath);

        const template = await readFile(templatePath, { encoding });

        const reifiedText = render(template, metadata);

        const targetPath = join(targetDirectory, relativePath);
        const parentDirectory = dirname(targetPath);

        await mkdir(parentDirectory, { recursive: true });

        await writeFile(targetPath, reifiedText, { encoding });
      }
    );

    await Promise.all(parallelTemplatePromises);
  }
}
