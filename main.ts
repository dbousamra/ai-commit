import { exists } from 'https://deno.land/std@0.224.0/fs/mod.ts';
import OpenAI from 'npm:openai';
import { simpleGit } from 'npm:simple-git';

const getIgnoreFiles = async (currentDir: string): Promise<string[]> => {
  const ignoreFilePath = `${currentDir}/.aicommitignore`;
  const ignoreFileExists = await exists(ignoreFilePath);

  if (!ignoreFileExists) {
    return [];
  }

  const decoder = new TextDecoder('utf-8');
  const data = await Deno.readFile(`${currentDir}/.aicommitignore`);
  const lines = decoder
    .decode(data)
    .split('\n')
    .filter((line) => line.trim() !== '');

  return lines.map((line) => `:!${line}`);
};

const currentDir = Deno.cwd();
const ignoreFiles = await getIgnoreFiles(currentDir);
const diff = await simpleGit(currentDir).diff(['--staged', ...ignoreFiles]);

const openai = new OpenAI({
  apiKey: Deno.env.get('OPEN_AI_API_KEY'),
});

const completion = await openai.chat.completions.create({
  messages: [
    {
      role: 'system',
      content: `You are to act as the author of a commit message in git.
        Your mission is to create clean and comprehensive
        commit messages as per the conventional commit convention
        and explain WHAT were the changes and mainly WHY the changes
        were done. I'll send you an output of 'git diff --staged' command,
        and you are to convert it into a commit message.

        Do not preface the commit with anything. Conventional commit keywords:
        'fix, feat, build, chore, ci, docs, style, refactor, perf, test.'

        Craft a concise one line commit message that encapsulates all changes made,
        with an emphasis on the primary updates. The goal is to provide a clear and unified
        overview of the changes in a one single message, without diverging
        into a list of commit per file change. Only give a single line commit message, 
        without a description
        `,
    },
    {
      role: 'user',
      content: diff,
    },
  ],
  model: 'gpt-3.5-turbo',
});

const commitMessage = completion.choices[0]?.message?.content;

if (!commitMessage) {
  console.error('Failed to generate commit message');
  Deno.exit(1);
}

console.log(commitMessage);
