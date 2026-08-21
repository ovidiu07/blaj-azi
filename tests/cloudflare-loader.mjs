export async function resolve(specifier, context, nextResolve) {
  if (specifier === "cloudflare:workers") {
    return {
      url: "data:text/javascript,export const env = globalThis.__BLAJ_TEST_ENV__ || {}%3B",
      shortCircuit: true,
    };
  }
  if (specifier === "next/headers") {
    return { url: "data:text/javascript,export async function cookies()%7Breturn%20%7Bget()%7Breturn%20undefined%7D%7D%7D%3Bexport%20async%20function%20headers()%7Breturn%20new%20Headers()%7D%3B", shortCircuit: true };
  }
  if (specifier === "next/navigation") {
    return { url: "data:text/javascript,export function redirect(path)%7Bthrow%20Object.assign(new%20Error(%27redirect%27),%7Bpath%7D)%7D%3Bexport%20function%20notFound()%7Bthrow%20new%20Error(%27not-found%27)%7D%3B", shortCircuit: true };
  }
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (error?.code === "ERR_MODULE_NOT_FOUND" && specifier.startsWith(".") && !/\.[cm]?[jt]sx?$/.test(specifier)) {
      return nextResolve(`${specifier}.ts`, context);
    }
    throw error;
  }
}
