import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { bunRun, bunRunAsScript, bunTest, tempDirWithFiles, bunExe, bunEnv } from "harness";
import path from "path";

function bunRunWithoutTrim(file: string, env?: Record<string, string>) {
  const result = Bun.spawnSync([bunExe(), file], {
    cwd: path.dirname(file),
    env: {
      ...bunEnv,
      NODE_ENV: undefined,
      ...env,
    },
  });
  if (!result.success) throw new Error(result.stderr.toString("utf8"));
  return {
    stdout: result.stdout.toString("utf8"),
    stderr: result.stderr.toString("utf8").trim(),
  };
}

describe(".env file is loaded", () => {
  test(".env", () => {
    const dir = tempDirWithFiles("dotenv", {
      ".env": "FOO=bar\n",
      "index.ts": "console.log(process.env.FOO);",
    });
    const { stdout } = bunRun(`${dir}/index.ts`);
    expect(stdout).toBe("bar");
  });
  test(".env.local", () => {
    const dir = tempDirWithFiles("dotenv", {
      ".env": "FOO=fail\nBAR=baz\n",
      ".env.local": "FOO=bar\n",
      "index.ts": "console.log(process.env.FOO, process.env.BAR);",
    });
    const { stdout } = bunRun(`${dir}/index.ts`);
    expect(stdout).toBe("bar baz");
  });
  test(".env.development (NODE_ENV=undefined)", () => {
    const dir = tempDirWithFiles("dotenv", {
      ".env": "FOO=fail\nBAR=baz\n",
      ".env.development": "FOO=bar\n",
      ".env.local": "LOCAL=true\n",
      "index.ts": "console.log(process.env.FOO, process.env.BAR, process.env.LOCAL);",
    });
    const { stdout } = bunRun(`${dir}/index.ts`);
    expect(stdout).toBe("bar baz true");
  });
  test(".env.development (NODE_ENV=development)", () => {
    const dir = tempDirWithFiles("dotenv", {
      ".env": "FOO=fail\nBAR=baz\n",
      ".env.development": "FOO=bar\n",
      ".env.local": "LOCAL=true\n",
      "index.ts": "console.log(process.env.FOO, process.env.BAR, process.env.LOCAL);",
    });
    const { stdout } = bunRun(`${dir}/index.ts`);
    expect(stdout).toBe("bar baz true");
  });
  test(".env.production", () => {
    const dir = tempDirWithFiles("dotenv", {
      ".env": "FOO=fail\nBAR=baz\n",
      ".env.production": "FOO=bar\n",
      ".env.local": "LOCAL=true\n",
      "index.ts": "console.log(process.env.FOO, process.env.BAR, process.env.LOCAL);",
    });
    const { stdout } = bunRun(`${dir}/index.ts`, { NODE_ENV: "production" });
    expect(stdout).toBe("bar baz true");
  });
  test(".env.development and .env.test ignored when NODE_ENV=production", () => {
    const dir = tempDirWithFiles("dotenv", {
      ".env": "FOO=bar\nBAR=baz\n",
      ".env.development": "FOO=development\n",
      ".env.development.local": "FOO=development.local\n",
      ".env.test": "FOO=test\n",
      ".env.test.local": "FOO=test.local\n",
      ".env.local": "LOCAL=true\n",
      "index.ts": "console.log(process.env.FOO, process.env.BAR, process.env.LOCAL);",
    });
    const { stdout } = bunRun(`${dir}/index.ts`, { NODE_ENV: "production" });
    expect(stdout).toBe("bar baz true");
  });
  test(".env.production and .env.test ignored when NODE_ENV=development", () => {
    const dir = tempDirWithFiles("dotenv", {
      ".env": "FOO=bar\nBAR=baz\n",
      ".env.production": "FOO=production\n",
      ".env.production.local": "FOO=production.local\n",
      ".env.test": "FOO=test\n",
      ".env.test.local": "FOO=test.local\n",
      ".env.local": "LOCAL=true\n",
      "index.ts": "console.log(process.env.FOO, process.env.BAR, process.env.LOCAL);",
    });
    const { stdout } = bunRun(`${dir}/index.ts`, {});
    expect(stdout).toBe("bar baz true");
  });
  test(".env and .env.test used in testing", () => {
    const dir = tempDirWithFiles("dotenv", {
      ".env": "A=a\n",
      ".env.test.local": "B=b\n",
      ".env.test": "C=c\n",
      ".env.development": "FAIL=.env.development\n",
      ".env.development.local": "FAIL=.env.development.local\n",
      ".env.production": "FAIL=.env.production\n",
      ".env.production.local": "FAIL=.env.production.local\n",
      "index.test.ts": "console.log(process.env.A,process.env.B,process.env.C,process.env.FAIL);",
    });
    const { stdout } = bunTest(`${dir}/index.test.ts`, {});
    expect(stdout).toBe("a b c undefined");
  });
  test(".env.local ignored when bun test", () => {
    const dir = tempDirWithFiles("dotenv", {
      ".env": "FAILED=false\n",
      ".env.local": "FAILED=true\n",
      "index.test.ts": "console.log(process.env.FAILED);",
    });
    const { stdout } = bunTest(`${dir}/index.test.ts`, {});
    expect(stdout).toBe("false");
  });
  test(".env.development and .env.production ignored when bun test", () => {
    const dir = tempDirWithFiles("dotenv", {
      ".env": "FAILED=false\n",
      ".env.development": "FAILED=development\n",
      ".env.development.local": "FAILED=development.local\n",
      ".env.production": "FAILED=production\n",
      ".env.production.local": "FAILED=production.local\n",
      "index.test.ts": "console.log(process.env.FAILED);",
    });
    const { stdout } = bunTest(`${dir}/index.test.ts`);
    expect(stdout).toBe("false");
  });
  test.todo("NODE_ENV is automatically set to test within bun test", () => {
    const dir = tempDirWithFiles("dotenv", {
      "index.test.ts": "console.log(process.env.NODE_ENV);",
    });
    const { stdout } = bunTest(`${dir}/index.test.ts`);
    expect(stdout).toBe("test");
  });
});
describe("dotenv priority", () => {
  test("process env overrides everything else", () => {
    const dir = tempDirWithFiles("dotenv", {
      ".env": "FOO=.env\n",
      ".env.development": "FOO=.env.development\n",
      ".env.development.local": "FOO=.env.development.local\n",
      ".env.production": "FOO=.env.production\n",
      ".env.production.local": "FOO=.env.production.local\n",
      ".env.test.local": "FOO=.env.test.local\n",
      ".env.test": "FOO=.env.test\n",
      ".env.local": "FOO=.env.local\n",
      "index.ts": "console.log(process.env.FOO);",
      "index.test.ts": "console.log(process.env.FOO);",
    });
    const { stdout } = bunRun(`${dir}/index.ts`, { FOO: "override" });
    expect(stdout).toBe("override");

    const { stdout: stdout2 } = bunTest(`${dir}/index.test.ts`, { FOO: "override" });
    expect(stdout2).toBe("override");
  });
  test(".env.{NODE_ENV}.local overrides .env.local", () => {
    const dir = tempDirWithFiles("dotenv", {
      ".env": "FOO=.env\n",
      ".env.development": "FOO=.env.development\n",
      ".env.development.local": "FOO=.env.development.local\n",
      ".env.production": "FOO=.env.production\n",
      ".env.production.local": "FOO=.env.production.local\n",
      ".env.test.local": "FOO=.env.test.local\n",
      ".env.test": "FOO=.env.test\n",
      ".env.local": "FOO=.env.local\n",
      "index.ts": "console.log(process.env.FOO);",
      "index.test.ts": "console.log(process.env.FOO);",
    });
    const { stdout: stdout_dev } = bunRun(`${dir}/index.ts`, { NODE_ENV: "development" });
    expect(stdout_dev).toBe(".env.development.local");
    const { stdout: stdout_prod } = bunRun(`${dir}/index.ts`, { NODE_ENV: "production" });
    expect(stdout_prod).toBe(".env.production.local");
    const { stdout: stdout_test } = bunTest(`${dir}/index.test.ts`, {});
    expect(stdout_test).toBe(".env.test.local");
  });
  test(".env.local overrides .env.{NODE_ENV}", () => {
    const dir = tempDirWithFiles("dotenv", {
      ".env": "FOO=.env\n",
      ".env.development": "FOO=.env.development\n",
      ".env.production": "FOO=.env.production\n",
      ".env.test": "FOO=.env.test\n",
      ".env.local": "FOO=.env.local\n",
      "index.ts": "console.log(process.env.FOO);",
      "index.test.ts": "console.log(process.env.FOO);",
    });
    const { stdout: stdout_dev } = bunRun(`${dir}/index.ts`, { NODE_ENV: "development" });
    expect(stdout_dev).toBe(".env.local");
    const { stdout: stdout_prod } = bunRun(`${dir}/index.ts`, { NODE_ENV: "production" });
    expect(stdout_prod).toBe(".env.local");
    // .env.local is "not checked when `NODE_ENV` is `test`"
    const { stdout: stdout_test } = bunTest(`${dir}/index.test.ts`, {});
    expect(stdout_test).toBe(".env.test");
  });
  test(".env.{NODE_ENV} overrides .env", () => {
    const dir = tempDirWithFiles("dotenv", {
      ".env": "FOO=.env\n",
      ".env.development": "FOO=.env.development\n",
      ".env.production": "FOO=.env.production\n",
      ".env.test": "FOO=.env.test\n",
      "index.ts": "console.log(process.env.FOO);",
      "index.test.ts": "console.log(process.env.FOO);",
    });
    const { stdout: stdout_dev } = bunRun(`${dir}/index.ts`, { NODE_ENV: "development" });
    expect(stdout_dev).toBe(".env.development");
    const { stdout: stdout_prod } = bunRun(`${dir}/index.ts`, { NODE_ENV: "production" });
    expect(stdout_prod).toBe(".env.production");
    const { stdout: stdout_test } = bunTest(`${dir}/index.test.ts`, {});
    expect(stdout_test).toBe(".env.test");
  });
});

test(".env colon assign", () => {
  const dir = tempDirWithFiles("dotenv-colon", {
    ".env": "FOO: foo",
    "index.ts": "console.log(process.env.FOO);",
  });
  const { stdout } = bunRun(`${dir}/index.ts`);
  expect(stdout).toBe("foo");
});

test(".env export assign", () => {
  const dir = tempDirWithFiles("dotenv-export", {
    ".env": "export FOO = foo\nexport = bar",
    "index.ts": "console.log(process.env.FOO, process.env.export);",
  });
  const { stdout } = bunRun(`${dir}/index.ts`);
  expect(stdout).toBe("foo bar");
});

test(".env value expansion", () => {
  const dir = tempDirWithFiles("dotenv-expand", {
    ".env": "FOO=foo\nBAR=$FOO bar\nMOO=${FOO} ${BAR:-fail} ${MOZ:-moo}",
    "index.ts": "console.log([process.env.FOO, process.env.BAR, process.env.MOO].join('|'));",
  });
  const { stdout } = bunRun(`${dir}/index.ts`);
  expect(stdout).toBe("foo|foo bar|foo foo bar moo");
});

test(".env comments", () => {
  const dir = tempDirWithFiles("dotenv-comments", {
    ".env": "#FOZ\nFOO = foo#FAIL\nBAR='bar' #BAZ",
    "index.ts": "console.log(process.env.FOO, process.env.BAR);",
  });
  const { stdout } = bunRun(`${dir}/index.ts`);
  expect(stdout).toBe("foo bar");
});

test(".env process variables no comments", () => {
  const dir = tempDirWithFiles("env-no-comments", {
    "index.ts": "console.log(process.env.TEST1, process.env.TEST2);",
  });
  const { stdout } = bunRun(`${dir}/index.ts`, { TEST1: "test#1", TEST2: '"test#2"' });
  expect(stdout).toBe('test#1 "test#2"');
});

describe("package scripts load from .env.production and .env.development", () => {
  test("NODE_ENV=production", () => {
    const dir = tempDirWithFiles("dotenv-package-script-prod", {
      "index.ts": "console.log(process.env.TEST);",
      "package.json": `
      {
        "name": "foo",
        "version": "2.0",
        "scripts": {
          "test": "NODE_ENV=production ${bunExe()} run index.ts",
        }
      }
      `,
      ".env.production": "TEST=prod",
      ".env.development": "TEST=dev",
    });

    const { stdout } = bunRunAsScript(dir, "test");
    expect(stdout).toBe("prod");
  });
  test("NODE_ENV=development", () => {
    const dir = tempDirWithFiles("dotenv-package-script-prod", {
      "index.ts": "console.log(process.env.TEST);",
      "package.json": `
        {
          "name": "foo",
          "version": "2.0",
          "scripts": {
            "test": "NODE_ENV=development ${bunExe()} run index.ts",
          }
        }
        `,
      ".env.production": "TEST=prod",
      ".env.development": "TEST=dev",
    });

    const { stdout } = bunRunAsScript(dir, "test");
    expect(stdout).toBe("dev");
  });
});

test(".env escaped dollar sign", () => {
  const dir = tempDirWithFiles("dotenv-dollar", {
    ".env": "FOO=foo\nBAR=\\$FOO",
    "index.ts": "console.log(process.env.FOO, process.env.BAR);",
  });
  const { stdout } = bunRun(`${dir}/index.ts`);
  expect(stdout).toBe("foo $FOO");
});

test(".env doesnt crash with 159 bytes", () => {
  const dir = tempDirWithFiles("dotenv-159", {
    ".env":
      "123456789=1234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678" +
      "\n",
    "index.ts": "console.log(process.env['123456789']);",
    "package.json": `{
      "name": "foo",
      "devDependencies": {
        "conditional-type-checks": "1.0.6",
        "prettier": "2.8.8",
        "tsd": "0.22.0",
        "typescript": "5.0.4"
      }
    }`,
  });

  const { stdout } = bunRun(`${dir}/index.ts`);
  expect(stdout.trim()).toBe(
    `1234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678`,
  );
});

test(".env with 50000 entries", () => {
  const dir = tempDirWithFiles("dotenv-many-entries", {
    ".env": new Array(50000)
      .fill(null)
      .map((_, i) => `TEST_VAR${i}=TEST_VAL${i}`)
      .join("\n"),
    "index.ts": /* ts */ `
      for (let i = 0; i < 50000; i++) {
        if(process.env['TEST_VAR' + i] !== 'TEST_VAL' + i) {
          throw new Error('TEST_VAR' + i + ' !== TEST_VAL' + i);
        }
      }
      console.log('OK');
    `,
  });
  const { stdout } = bunRun(`${dir}/index.ts`);
  expect(stdout).toBe("OK");
});

test(".env space edgecase (issue #411)", () => {
  const dir = tempDirWithFiles("dotenv-issue-411", {
    ".env": "VARNAME=A B",
    "index.ts": "console.log('[' + process.env.VARNAME + ']');",
  });
  const { stdout } = bunRun(`${dir}/index.ts`);
  expect(stdout).toBe("[A B]");
});

test(".env special characters 1 (issue #2823)", () => {
  const dir = tempDirWithFiles("dotenv-issue-2823", {
    ".env": 'A="a$t"\nC=`c\\$v`',
    "index.ts": "console.log('[' + process.env.A + ']', '[' + process.env.C + ']');",
  });
  const { stdout } = bunRun(`${dir}/index.ts`);
  expect(stdout).toBe("[a] [c$v]");
});

test.todo("env escaped quote (issue #2484)", () => {
  const dir = tempDirWithFiles("env-issue-2484", {
    "index.ts": "console.log(process.env.VALUE, process.env.VALUE2);",
  });
  const { stdout } = bunRun(`${dir}/index.ts`, { VALUE: `\\"`, VALUE2: `\\\\"` });
  expect(stdout).toBe('\\" \\\\"');
});

test(".env Windows-style newline (issue #3042)", () => {
  const dir = tempDirWithFiles("dotenv-issue-3042", {
    ".env": "FOO=\rBAR='bar\r\rbaz'\r\nMOO=moo\r",
    "index.ts": "console.log([process.env.FOO, process.env.BAR, process.env.MOO].join('|'));",
  });
  const { stdout } = bunRun(`${dir}/index.ts`);
  expect(stdout).toBe("|bar\n\nbaz|moo");
});

test(".env with zero length strings", () => {
  const dir = tempDirWithFiles("dotenv-issue-zerolength", {
    ".env": "FOO=''\n",
    "index.ts":
      "function i(a){return a}\nconsole.log([process.env.FOO,i(process.env).FOO,process.env.FOO.length,i(process.env).FOO.length].join('|'));",
  });
  const { stdout } = bunRun(`${dir}/index.ts`);
  expect(stdout).toBe("||0|0");
});

test("process with zero length environment variable", () => {
  const dir = tempDirWithFiles("process-issue-zerolength", {
    "index.ts": "console.log(`'${process.env.TEST_ENV_VAR}'`);",
  });
  const { stdout } = bunRun(`${dir}/index.ts`, {
    TEST_ENV_VAR: "",
  });
  expect(stdout).toBe("''");
});

test(".env in a folder doesn't throw an error", () => {
  const dir = tempDirWithFiles("dotenv-issue-3670", {
    ".env": {
      ".env.local": "FOO=''\n",
    },
    "index.ts": "console.write('hey')",
    "package.json": '{ "name": ' + '"test"' + " }",
  });
  const { stdout } = bunRun(`${dir}/index.ts`);
  expect(stdout).toBe("hey");
});

test("#3911", () => {
  const dir = tempDirWithFiles("dotenv", {
    ".env": 'KEY="a\\nb"',
    "index.ts": "console.log(process.env.KEY);",
  });
  const { stdout } = bunRun(`${dir}/index.ts`);
  expect(stdout).toBe("a\nb");
});

describe("boundary tests", () => {
  test("src boundary", () => {
    const dir = tempDirWithFiles("dotenv", {
      ".env": 'KEY="a\\n"',
      "index.ts": "console.log(process.env.KEY);",
    });
    const { stdout } = bunRunWithoutTrim(`${dir}/index.ts`);
    // should be "a\n" but console.log adds a newline
    expect(stdout).toBe("a\n\n");

    const dir2 = tempDirWithFiles("dotenv", {
      ".env": 'KEY="a\\n',
      "index.ts": "console.log(process.env.KEY);",
    });
    const { stdout: stdout2 } = bunRunWithoutTrim(`${dir2}/index.ts`);
    // should be "a\n but console.log adds a newline
    expect(stdout2).toBe('"a\n\n');
  });

  test("buffer boundary", () => {
    const expected = "a".repeat(4094);
    let content = expected + "a";
    const dir = tempDirWithFiles("dotenv", {
      ".env": `KEY="${content}"`,
      "index.ts": "console.log(process.env.KEY);",
    });
    const { stdout } = bunRun(`${dir}/index.ts`);

    content = expected + "\\n";
    const dir2 = tempDirWithFiles("dotenv", {
      ".env": `KEY="${content}"`,
      "index.ts": "console.log(process.env.KEY);",
    });
    const { stdout: stdout2 } = bunRun(`${dir2}/index.ts`);
    // should be truncated
    expect(stdout).toBe(expected);
    expect(stdout2).toBe(expected);
  });
});

describe("access from different apis", () => {
  let dir = "";
  beforeAll(() => {
    dir = tempDirWithFiles("dotenv", {
      ".env": "FOO=1\n",
      "index1.ts": "console.log(Bun.env.FOO);",
      "index2.ts": "console.log(process.env.FOO); ",
      "index3.ts": "console.log(import.meta.env.FOO);",
      "index4.ts": "console.log(import.meta.env.FOO + Bun.env.FOO);",
      "index5.ts": "console.log(Bun.env.FOO + import.meta.env.FOO);",
    });
  });

  test("only Bun.env", () => expect(bunRun(`${dir}/index1.ts`).stdout).toBe("1"));
  test("only process.env", () => expect(bunRun(`${dir}/index2.ts`).stdout).toBe("1"));
  test("only import.meta.env", () => expect(bunRun(`${dir}/index3.ts`).stdout).toBe("1"));
  test("import.meta.env as 1st access", () => expect(bunRun(`${dir}/index4.ts`).stdout).toBe("11"));
  test("import.meta.env as 2nd access", () => expect(bunRun(`${dir}/index5.ts`).stdout).toBe("11"));
});

describe("--env-file", () => {
  let dir = "";
  beforeAll(() => {
    dir = tempDirWithFiles("dotenv-arg", {
      ".env": "BUNTEST_DOTENV=1",
      ".env.a": "BUNTEST_A=1",
      ".env.b": "BUNTEST_B=1",
      ".env.c": "BUNTEST_C=1",
      ".env.a2": "BUNTEST_A=2",
      ".env.invalid":
        "BUNTEST_A=1\nBUNTEST_B =1\n BUNTEST_C =  1 \n...BUNTEST_invalid1\nBUNTEST_invalid2\nBUNTEST_D=\nBUNTEST_E=1",
      "subdir/.env.s": "BUNTEST_S=1",
      "index.ts":
        "console.log(Object.entries(process.env).flatMap(([k, v]) => k.startsWith('BUNTEST_') ? [`${k}=${v}`] : []).sort().join(','));",
    });
  });

  function bunRun(bunArgs: string[], envOverride?: Record<string, string>) {
    const file = `${dir}/index.ts`;
    const result = Bun.spawnSync([bunExe(), ...bunArgs, file], {
      cwd: path.dirname(file),
      env: {
        ...bunEnv,
        NODE_ENV: undefined,
        ...envOverride,
      },
    });
    if (!result.success) throw new Error(result.stderr.toString("utf8"));
    return {
      stdout: result.stdout.toString("utf8").trim(),
      stderr: result.stderr.toString("utf8").trim(),
    };
  }

  test("single arg", () => {
    expect(bunRun(["--env-file", ".env.a"]).stdout).toBe("BUNTEST_A=1");
    expect(bunRun(["--env-file=.env.a"]).stdout).toBe("BUNTEST_A=1");
  });

  test("multiple args", () => {
    expect(bunRun(["--env-file", ".env.a", "--env-file=.env.b"]).stdout).toBe("BUNTEST_A=1,BUNTEST_B=1");
  });

  test("single arg with multiple files", () => {
    expect(bunRun(["--env-file", ".env.a,.env.b,.env.c"]).stdout).toBe("BUNTEST_A=1,BUNTEST_B=1,BUNTEST_C=1");
  });

  test("priority on multi-file single arg", () => {
    expect(bunRun(["--env-file", ".env.a,.env.a2"]).stdout).toBe("BUNTEST_A=2");
  });

  test("priority on multiple args", () => {
    expect(bunRun(["--env-file", ".env.a", "--env-file", ".env.a2"]).stdout).toBe("BUNTEST_A=2");
  });

  test("priority on process env", () => {
    expect(
      bunRun(["--env-file=.env.a", "--env-file=.env.b"], {
        BUNTEST_PROCESS: "P",
        BUNTEST_A: "P",
      }).stdout,
    ).toBe("BUNTEST_A=P,BUNTEST_B=1,BUNTEST_PROCESS=P");
  });

  test("absolute filepath", () => {
    expect(bunRun(["--env-file", `${dir}/.env.a`]).stdout).toBe("BUNTEST_A=1");
  });

  test("explicit relative filepath", () => {
    expect(bunRun(["--env-file", "./.env.a"]).stdout).toBe("BUNTEST_A=1");
  });

  test("subdirectory filepath", () => {
    expect(bunRun(["--env-file", "subdir/.env.s"]).stdout).toBe("BUNTEST_S=1");
    expect(bunRun(["--env-file", "./subdir/.env.s"]).stdout).toBe("BUNTEST_S=1");
  });

  test("when arg missing, fallback to default dotenv behavior", () => {
    // if --env-file missing, it should fallback to the default builtin behavior (.env, .env.production, etc.)
    expect(bunRun([]).stdout).toBe("BUNTEST_DOTENV=1");
  });

  test("empty string disables default dotenv behavior", () => {
    expect(bunRun(["--env-file=''"]).stdout).toBe("");
  });

  test("should correctly ignore invalid values and parse the rest", () => {
    const res = bunRun(["--env-file=.env.invalid"]);
    expect(res.stdout).toBe("BUNTEST_A=1,BUNTEST_B=1,BUNTEST_C=1,BUNTEST_D=,BUNTEST_E=1");
  });

  test("should ignore a file that doesn't exist", () => {
    const res = bunRun(["--env-file=.env.nonexisting"]);
    expect(res.stdout).toBe("");
  });
});
