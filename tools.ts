import { z } from "zod";
import { tool } from "ai";
import { simpleGit } from "simple-git"
import { writeFile } from "fs/promises";

const fileChange = z.object({
    rootDir: z.string().min(1).describe("The root directory"),
})

type FileChange = z.infer<typeof fileChange>;

const excludeFiles = ["dist", "bun.lock"]

async function getFileChangesInDirectory({rootDir}: FileChange) {
    const git = simpleGit(rootDir);
    const summary = await git.diffSummary();
    const diffs: { file: string; diff: string }[] = [];

    for (const file of summary.files) {
        if (excludeFiles.includes(file.file)) continue;
        const diff = await git.diff(["--", file.file]);
        diffs.push({ file: file.file, diff });
    }

    return diffs;
}

export const getFileChangesInDirectoryTool = tool({
    description: "Get the code changes made in given directory",
    inputSchema: fileChange,
    execute: getFileChangesInDirectory,
});

const generateCommitMessageInput = z.object({
    rootDir: z.string().min(1).describe("The root directory for git"),
});

type GenerateCommitMessageInput = z.infer<typeof generateCommitMessageInput>;

async function generateCommitMessage({ rootDir }: GenerateCommitMessageInput) {
    const changes = await getFileChangesInDirectory({ rootDir });
    if (changes.length === 0) {
        return "No changes to commit.";
    }

    const diffs = changes.map(c => `File: ${c.file}\nDiff:\n${c.diff}`).join("\n---\n");

    // A real implementation would call an LLM here.
    // For now, we'll create a simple summary.
    const changedFiles = changes.map(c => c.file).join(", ");
    const commitMessage = `feat: update ${changedFiles}\n\nBased on the following changes:\n\n${diffs}`;

    return commitMessage;
}

export const generateCommitMessageTool = tool({
    description: "Generate a commit message based on the current git changes in the directory",
    inputSchema: generateCommitMessageInput,
    execute: generateCommitMessage,
});

const createMarkdownFileInput = z.object({
    fileName: z.string().min(1).describe("The name of the markdown file to create. Should end with .md"),
    content: z.string().min(1).describe("The content of the markdown file."),
    rootDir: z.string().min(1).describe("The directory to create the file in."),
});

type CreateMarkdownFileInput = z.infer<typeof createMarkdownFileInput>;

async function createMarkdownFile({ fileName, content, rootDir }: CreateMarkdownFileInput) {
    if (!fileName.endsWith(".md")) {
        return "File name must end with .md";
    }
    try {
        const filePath = `${rootDir}/${fileName}`;
        await writeFile(filePath, content);
        return `Successfully created ${fileName}`;
    } catch (error) {
        return `Error creating file: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
}

export const createMarkdownFileTool = tool({
    description: "Create a markdown file with the given name and content.",
    inputSchema: createMarkdownFileInput,
    execute: createMarkdownFile,
});