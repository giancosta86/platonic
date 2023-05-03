import { join } from "node:path";
import { tmpdir } from "node:os";
import { writeFile } from "node:fs/promises";
import { v4 as uuid4 } from "uuid";
import {
  getSourceDirectory,
  useVolatileTempDirectory
} from "@giancosta86/more-jest-io";
import { Archetype } from "./Archetype";

const testMetadata = {
  name: "Yogi",
  age: 36
} as const;

describe("Archetype", () => {
  describe("full reification", () => {
    const tempDirectory = useVolatileTempDirectory({ shared: true });

    beforeAll(async () => {
      const sourceDirectory = join(getSourceDirectory(), "test", "archetype");

      const archetype = new Archetype({
        sourceDirectory
      });

      await archetype.reify({
        targetDirectory: tempDirectory,
        metadata: testMetadata
      });
    });

    describe("when copying the static files", () => {
      it("should copy top-level regular files", async () => {
        await expect(join(tempDirectory, "alpha.txt")).toBeTextFile("Alpha");
        await expect(join(tempDirectory, "beta.md")).toBeTextFile(
          "Beta\nBeta 2\n"
        );
      });

      it("should copy top-level dot files", () =>
        expect(join(tempDirectory, ".alphaDot.txt")).toBeTextFile(
          "AlphaDot --> 90"
        ));

      it("should copy .gitignore files", () =>
        expect(join(tempDirectory, ".gitignore")).toBeTextFile(
          "/<X>\n/<Y>\n/<Z>"
        ));

      it("should copy regular files from a subdirectory", () =>
        expect(join(tempDirectory, "gamma", "delta.txt")).toBeTextFile(
          "Delta"
        ));

      it("should copy regular files from nested directories", () =>
        expect(join(tempDirectory, "gamma", "epsilon", "zeta.md")).toBeTextFile(
          "Zeta\nEta\nTheta\n"
        ));

      it("should copy dot files from nested directories", () =>
        expect(
          join(tempDirectory, "gamma", "epsilon", ".zetaDot")
        ).toBeTextFile("Zeta --> 92"));

      it("should copy template-like files without injecting variables", () =>
        expect(join(tempDirectory, "fakeTemplate.txt")).toBeTextFile(
          "Hello, <%= name %>!"
        ));
    });

    describe("when injecting metadata into templates", () => {
      it("should inject into top-level regular files", async () => {
        await expect(join(tempDirectory, "omicron.txt")).toBeTextFile(
          `Hello, ${testMetadata.name}!`
        );

        await expect(join(tempDirectory, "pi.md")).toBeTextFile(
          `${testMetadata.name} is a bear.\n\n${testMetadata.name} is ${testMetadata.age} years old.\n`
        );
      });

      it("should inject into top-level dot files", () =>
        expect(join(tempDirectory, ".omicronDot.txt")).toBeTextFile(
          `This is ${testMetadata.name}. ${testMetadata.name} is a ${testMetadata.age}-year-old bear.`
        ));

      it("should inject into files within a subdirectory", () =>
        expect(join(tempDirectory, "ro", "sigma.txt")).toBeTextFile(
          `${testMetadata.name} is a bear living in a park.`
        ));

      it("should inject into files within nested directories", () =>
        expect(join(tempDirectory, "ro", "tau", "omega.md")).toBeTextFile(
          `${testMetadata.name} --- ${testMetadata.age}\n`
        ));

      it("should inject into dot files within nested directories", () =>
        expect(join(tempDirectory, "ro", "tau", ".omegaDot")).toBeTextFile(
          `Name: ${testMetadata.name}\nAge: ${testMetadata.age}\n`
        ));
    });
  });

  describe("full reification to an existing, non-empty directory", () => {
    const tempDirectory = useVolatileTempDirectory({ shared: true });

    let existingOriginalFilePath: string;
    const existingOriginalFileContent = "This is my\nexisting file!";

    let existingStaticFilePath: string;
    let existingTemplateFilePath: string;

    beforeAll(async () => {
      existingOriginalFilePath = join(tempDirectory, "Original.txt");
      await writeFile(existingOriginalFilePath, existingOriginalFileContent);

      existingStaticFilePath = join(tempDirectory, "alpha.txt");
      await writeFile(existingStaticFilePath, uuid4());

      existingTemplateFilePath = join(tempDirectory, "omicron.txt");
      await writeFile(existingTemplateFilePath, uuid4());

      const sourceDirectory = join(getSourceDirectory(), "test", "archetype");

      const archetype = new Archetype({ sourceDirectory });

      await archetype.reify({
        targetDirectory: tempDirectory,
        metadata: testMetadata
      });
    });

    it("should keep existing, original files unaltered", () =>
      expect(existingOriginalFilePath).toBeTextFile(
        existingOriginalFileContent
      ));

    it("should replace existing, homonym files with static files", () =>
      expect(existingStaticFilePath).toBeTextFile("Alpha"));

    it("should replace existing, homonym files with template files", () =>
      expect(existingTemplateFilePath).toBeTextFile(
        `Hello, ${testMetadata.name}!`
      ));
  });

  describe("static-only reification", () => {
    const tempDirectory = useVolatileTempDirectory({ shared: true });

    let existingOriginalFilePath: string;
    const existingOriginalFileContent = "This is my\nexample file!";

    let existingStaticFilePath: string;
    let existingTemplateFilePath: string;

    beforeAll(async () => {
      existingOriginalFilePath = join(tempDirectory, "Original.txt");
      await writeFile(existingOriginalFilePath, existingOriginalFileContent);

      existingStaticFilePath = join(tempDirectory, "alpha.txt");
      await writeFile(existingStaticFilePath, uuid4());

      existingTemplateFilePath = join(tempDirectory, "omicron.txt");
      await writeFile(existingTemplateFilePath, uuid4());

      const sourceDirectory = join(
        getSourceDirectory(),
        "test",
        "staticOnlyArchetype"
      );
      const archetype = new Archetype({ sourceDirectory });

      await archetype.reify({
        targetDirectory: tempDirectory,
        metadata: testMetadata
      });
    });

    it("should work", () =>
      expect(join(tempDirectory, "justStatic.txt")).toBeTextFile(
        "This is a static-only example!"
      ));
  });

  describe("template-only reification", () => {
    const tempDirectory = useVolatileTempDirectory({ shared: true });

    beforeAll(async () => {
      const sourceDirectory = join(
        getSourceDirectory(),
        "test",
        "templateOnlyArchetype"
      );

      const archetype = new Archetype({ sourceDirectory });

      await archetype.reify({
        targetDirectory: tempDirectory,
        metadata: testMetadata
      });
    });

    it("should work", () =>
      expect(join(tempDirectory, "justTemplate.txt")).toBeTextFile(
        "This bear is Yogi; he is 36 years old."
      ));
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
