// @prisma/client lists the Prisma CLI and TypeScript as optional peers. They are only used
// to generate the client, which @yabe/db does with its own `prisma` dev dependency. Left in,
// pnpm resolves them from the workspace, and `pnpm deploy --prod` ships both (and the CLI's
// studio, dev server and PGlite) in every app image: about 270 MB that never runs.
module.exports = {
  hooks: {
    readPackage(pkg) {
      if (pkg.name === "@prisma/client") {
        for (const peer of ["prisma", "typescript"]) {
          delete pkg.peerDependencies?.[peer];
          delete pkg.peerDependenciesMeta?.[peer];
        }
      }
      return pkg;
    },
  },
};
