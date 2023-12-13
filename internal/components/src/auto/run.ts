import { LocalWorkspace } from "@pulumi/pulumi/automation/index.js";
import { runtime } from "@pulumi/pulumi";
import { PulumiFn } from "@pulumi/pulumi/automation";

export async function run(program: PulumiFn) {
  const stack = await LocalWorkspace.createOrSelectStack(
    {
      program: async () => {
        runtime.registerStackTransformation((args) => {
          if (
            app.removalPolicy === "retain-all" ||
            (app.removalPolicy === "retain" &&
              ["aws:s3/bucket:Bucket", "aws:dynamodb/table:Table"].includes(
                args.type
              ))
          ) {
            return {
              props: args.props,
              opts: util.mergeOptions({ retainOnDelete: true }, args.opts),
            };
          }
          return undefined;
        });

        return program();
      },
      projectName: app.name,
      stackName: app.stage,
    },
    {
      pulumiHome: app.paths.home,
      projectSettings: {
        main: app.paths.root,
        name: app.name,
        runtime: "nodejs",
        backend: {
          url: "s3://" + app.bootstrap.bucket,
        },
        config: JSON.stringify({
          "aws:defaultTags": {
            value: {
              tags: {
                "sst:app": app.name,
                "sst:stage": app.stage,
              },
            },
          },
        }),
      },
      envVars: {
        PULUMI_CONFIG_PASSPHRASE: "",
        PULUMI_SKIP_UPDATE_CHECK: "true",
        PULUMI_EXPERIMENTAL: "1",
        PULUMI_SKIP_CHECKPOINTS: "true",
        NODE_PATH: app.paths.temp + "/node_modules",
        ...app.aws,
      },
    }
  );

  try {
    const result = await stack[app.command as "up"]({
      logVerbosity: 11,
      onEvent: (evt) => {
        console.log("~j" + JSON.stringify(evt));
      },
    });
  } catch (e: any) {
    if (e.name === "ConcurrentUpdateError") {
      console.log("~j" + JSON.stringify({ ConcurrentUpdateEvent: {} }));
    }
  }
}