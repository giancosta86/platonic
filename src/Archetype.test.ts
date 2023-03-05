import { join } from "node:path";
import { tmpdir } from "node:os";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { v4 as uuid4 } from "uuid";
import rimraf from "rimraf";
import { Archetype } from "./Archetype";

const testMetadata = {
  name: "Yogi",
  age: 36
} as const;

class TestReification {
  constructor(private readonly tempTargetDirectory: string) {}

  private getTargetPath(relativePath: string): string {
    return join(this.tempTargetDirectory, relativePath);
  }

  async expectTargetText(
    relativePath: string,
    expectedText: string
  ): Promise<void> {
    const fullPath = this.getTargetPath(relativePath);

    const actualText = await readFile(fullPath, {
      encoding: "utf8"
    });

    expect(actualText).toBe(expectedText);
  }

  deltree(): Promise<void> {
    return rimraf(this.tempTargetDirectory);
  }
}

async function createTestReification(
  sourceDirectory: string
): Promise<TestReification> {
  const archetype = new Archetype({
    sourceDirectory
  });

  const tempTargetDirectory = join(tmpdir(), uuid4());

  await archetype.reify({
    targetDirectory: tempTargetDirectory,
    metadata: testMetadata
  });

  return new TestReification(tempTargetDirectory);
}

describe("Archetype", () => {
  describe("full reification", () => {
    let testReification: TestReification;

    beforeAll(async () => {
      const sourceDirectory = join(__dirname, "..", "test", "archetype");

      testReification = await createTestReification(sourceDirectory);
    });

    afterAll(async () => {
      await testReification.deltree();
    });

    describe("when copying the static files", () => {
      it("should copy top-level regular files", async () => {
        await testReification.expectTargetText("alpha.txt", "Alpha");
        await testReification.expectTargetText("beta.md", "Beta\nBeta 2\n");
      });

      it("should copy top-level dot files", async () => {
        await testReification.expectTargetText(
          ".alphaDot.txt",
          "AlphaDot --> 90"
        );
      });

      it("should copy regular files from a directory", async () => {
        await testReification.expectTargetText(
          join("gamma", "delta.txt"),
          "Delta"
        );
      });

      it("should copy regular files from nested directories", async () => {
        await testReification.expectTargetText(
          join("gamma", "epsilon", "zeta.md"),
          "Zeta\nEta\nTheta\n"
        );
      });

      it("should copy dot files from nested directories", async () => {
        await testReification.expectTargetText(
          join("gamma", "epsilon", ".zetaDot"),
          "Zeta --> 92"
        );
      });

      it("should copy template-like files without injecting variables", () =>
        testReification.expectTargetText(
          "fakeTemplate.txt",
          "Hello, <%= name %>!"
        ));
    });

    describe("when injecting metadata into templates", () => {
      it("should inject into top-level regular files", async () => {
        await testReification.expectTargetText(
          "omicron.txt",
          `Hello, ${testMetadata.name}!`
        );

        await testReification.expectTargetText(
          "pi.md",
          `${testMetadata.name} is a bear.\n\n${testMetadata.name} is ${testMetadata.age} years old.\n`
        );
      });

      it("should inject into top-level dot files", async () => {
        await testReification.expectTargetText(
          ".omicronDot.txt",
          `This is ${testMetadata.name}. ${testMetadata.name} is a ${testMetadata.age}-year-old bear.`
        );
      });

      it("should inject into files within a directory", async () => {
        await testReification.expectTargetText(
          join("ro", "sigma.txt"),
          `${testMetadata.name} is a bear living in a park.`
        );
      });

      it("should inject into files within nested directories", async () => {
        await testReification.expectTargetText(
          join("ro", "tau", "omega.md"),
          `${testMetadata.name} --- ${testMetadata.age}\n`
        );
      });

      it("should inject into dot files within nested directories", async () => {
        await testReification.expectTargetText(
          join("ro", "tau", ".omegaDot"),
          `Name: ${testMetadata.name}\nAge: ${testMetadata.age}\n`
        );
      });
    });
  });

  describe("full reification to an existing directory", () => {
    let tempDirectory: string;

    let existingOriginalFilePath: string;
    const existingOriginalFileContent = "This is my\nexample file!";

    let existingStaticFilePath: string;
    let existingTemplateFilePath: string;

    beforeAll(async () => {
      tempDirectory = join(tmpdir(), uuid4());
      await mkdir(tempDirectory, { recursive: true });

      existingOriginalFilePath = join(tempDirectory, "Original.txt");
      await writeFile(existingOriginalFilePath, existingOriginalFileContent);

      existingStaticFilePath = join(tempDirectory, "alpha.txt");
      await writeFile(existingStaticFilePath, uuid4());

      existingTemplateFilePath = join(tempDirectory, "omicron.txt");
      await writeFile(existingTemplateFilePath, uuid4());

      const sourceDirectory = join(__dirname, "..", "test", "archetype");

      const archetype = new Archetype({ sourceDirectory });

      await archetype.reify({
        targetDirectory: tempDirectory,
        metadata: testMetadata
      });
    });

    afterAll(async () => {
      await rimraf(tempDirectory);
    });

    it("should keep existing, original files unaltered", async () => {
      const actualContent = await readFile(existingOriginalFilePath, {
        encoding: "utf8"
      });

      expect(actualContent).toBe(existingOriginalFileContent);
    });

    it("should replace existing, homonym files with static files", async () => {
      const actualContent = await readFile(existingStaticFilePath, {
        encoding: "utf8"
      });

      expect(actualContent).toBe("Alpha");
    });

    it("should replace existing, homonym files with template files", async () => {
      const actualContent = await readFile(existingTemplateFilePath, {
        encoding: "utf8"
      });

      expect(actualContent).toBe(`Hello, ${testMetadata.name}!`);
    });
  });

  describe("static-only reification", () => {
    let reification: TestReification;

    beforeAll(async () => {
      const sourceDirectory = join(
        __dirname,
        "..",
        "test",
        "staticOnlyArchetype"
      );

      reification = await createTestReification(sourceDirectory);
    });

    afterAll(async () => {
      await reification.deltree();
    });

    it("should work", async () => {
      await reification.expectTargetText(
        "justStatic.txt",
        "This is a static-only example!"
      );
    });
  });

  describe("template-only reification", () => {
    let reification: TestReification;

    beforeAll(async () => {
      const sourceDirectory = join(
        __dirname,
        "..",
        "test",
        "templateOnlyArchetype"
      );

      reification = await createTestReification(sourceDirectory);
    });

    afterAll(async () => {
      await reification.deltree();
    });

    it("should work", async () => {
      await reification.expectTargetText(
        "justTemplate.txt",
        "This bear is Yogi; he is 36 years old."
      );
    });
  });

  describe("badly-performed reification", () => {
    it("should throw when the source directory does not exist", async () => {
      const archetype = new Archetype({
        sourceDirectory: join(__dirname, "<INEXISTING>")
      });

      await expect(
        archetype.reify({
          targetDirectory: join(tmpdir(), "<SOME DIRECTORY>"),
          metadata: testMetadata
        })
      ).rejects.toThrow("The source directory does not exist");
    });
  });
});
