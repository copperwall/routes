module.exports = {
  getDoc,
  getApi,
  getOperationId,
  getScope,
  getIdName,
  assignResponse
};

const { resolve: pathResolve } = require("path");
const { readdirSync } = require("fs");
const { kebabCase } = require("lodash");
const pluralize = require("pluralize");
const _ = require("lodash");
const toJsonSchema = require("generate-schema").json;

const PUBLIC_API = "api.github.com";
const APIS = readdirSync(pathResolve(__dirname, "..", "openapi"));
const FILL_WORDS = [
  "a",
  "all",
  "an",
  "available",
  "being",
  "existing",
  "github",
  "has been",
  "individual",
  "if you are",
  "new",
  "single",
  "specific",
  "specified",
  "the",
  "this",
  "your"
];
const IGNORE_WORDS_AT_END = ["about", "for", "from", "of", "on", "to"];

function getApi(rawApi) {
  if (!rawApi) {
    return PUBLIC_API;
  }
  const api = !isNaN(rawApi) ? `ghe-${rawApi}` : rawApi;
  if (APIS.includes(api)) {
    return api;
  }
  throw new Error(
    `"${rawApi}" is not a valid API. Must be one of: "${APIS.join('", "')}".`
  );
}

function getDoc(rawApi) {
  const api = getApi(rawApi);
  const doc = require(`../openapi/${api}/index.json`);
  for (const path of Object.keys(doc.paths)) {
    for (const method of Object.keys(doc.paths[path])) {
      const op = doc.paths[path][method];
      if (doc.paths[path][method].$ref) {
        doc.paths[path][method] = require(`../openapi/${api}/${op.$ref}`);
      }
    }
  }
  return doc;
}

function getOperationId(route) {
  const scope = getScope(route.operation.externalDocs.url);
  const idName = getIdName(route, scope);
  return `${scope}/${idName}`;
}

function getScope(documentationUrl) {
  const scope = documentationUrl.match(/\/v3\/([^/#]+)/).pop();
  return kebabCase(scope);
}

function getIdName(endpoint, scope) {
  const { method, path } = endpoint;
  // endpoint-specific exceptions
  const route = `${method} ${path}`;
  switch (route) {
    // suggested to change in docs
    case "GET /gists":
      return "list";
    case "GET /issues":
      return "list";
    case "POST /markdown":
      return "render";
    case "POST /markdown/raw":
      return "render-raw";
    case "GET /orgs/:org/issues":
      return "list-for-org";
    case "GET /orgs/:org/members":
      return "list-members";
    case "GET /orgs/:org/public_members":
      return "list-public-members";
    case "GET /repos/:owner/:repo/collaborators/:username/permission":
      return "get-collaborator-permission-level";
    case "POST /repos/:owner/:repo/merges":
      return "merge";
    case "GET /repos/:owner/:repo/pulls/:pull_number/merge":
      return "check-if-merged";
    case "GET /repos/:owner/:repo/traffic/popular/paths":
      return "get-top-paths";
    case "GET /repos/:owner/:repo/traffic/popular/referrers":
      return "get-top-referrers";
    case "GET /teams/:team_id/discussions/:discussion_number/comments":
      return "list-discussion-comments";
    case "POST /teams/:team_id/discussions/:discussion_number/comments":
      return "create-discussion-comment";
    case "GET /teams/:team_id/discussions/:discussion_number/comments/:comment_number":
      return "get-discussion-comment";
    case "PATCH /teams/:team_id/discussions/:discussion_number/comments/:comment_number":
      return "update-discussion-comment";
    case "DELETE /teams/:team_id/discussions/:discussion_number/comments/:comment_number":
      return "delete-discussion-comment";
    case "GET /users":
      return "list";
    case "GET /users/:username":
      return "get-by-username";
    case "GET /users/:username/orgs":
      return "list-for-user";
    case "GET /repos/:owner/:repo/subscribers":
      return "list-watchers-for-repo";
    case "GET /repos/:owner/:repo/stargazers":
      return "list-stargazers-for-repo";
    case "GET /repos/:owner/:repo/issues/:issue_number/timeline":
      return "list-events-for-timeline";
    case "GET /user/blocks/:username":
      return "check-blocked";
    case "DELETE /orgs/:org/migrations/:migration_id/repos/:repo_name/lock":
      return "unlock-repo-for-org";
    case "GET /repos/:owner/:repo/branches/:branch/protection/restrictions/apps":
      return "get-apps-with-access-to-protected-branch";
    case "GET /repos/:owner/:repo/branches/:branch/protection/restrictions/teams":
      return "get-teams-with-access-to-protected-branch";
    case "GET /repos/:owner/:repo/branches/:branch/protection/restrictions/users":
      return "get-users-with-access-to-protected-branch";

    // https://github.com/octokit/routes/issues/174
    case "GET /user/installations":
      return "list-installations-for-authenticated-user";
    case "GET /user/installations/:installation_id/repositories":
      return "list-installation-repos-for-authenticated-user";
    case "GET /user/marketplace_purchases":
      return "list-marketplace-purchases-for-authenticated-user";
    case "GET /user/marketplace_purchases/stubbed":
      return "list-marketplace-purchases-for-authenticated-user-stubbed";
    case "POST /user/migrations":
      return "start-for-authenticated-user";
    case "GET /user/migrations":
      return "list-for-authenticated-user";
    case "GET /user/migrations/:migration_id":
      return "get-status-for-authenticated-user";
    case "GET /user/migrations/:migration_id/archive":
      return "get-archive-for-authenticated-user";
    case "DELETE /user/migrations/:migration_id/archive":
      return "delete-archive-for-authenticated-user";
    case "DELETE /user/migrations/:migration_id/repos/:repo_name/lock":
      return "unlock-repo-for-authenticated-user";
    case "GET /user/teams":
      return "list-for-authenticated-user";
    case "GET /user/repository_invitations":
      return "list-invitations-for-authenticated-user";
    case "GET /user/following":
      return "list-following-for-authenticated-user";
    case "GET /user/issues":
      return "list-for-authenticated-user";
    case "GET /user/subscriptions":
      return "list-watched-repos-for-authenticated-user";
    case "GET /user/followers":
      return "list-followers-for-authenticated-user";
    case "GET /user/orgs":
      return "list-for-authenticated-user";
    case "GET /user/memberships/orgs/:org":
      return "get-membership-for-authenticated-user";

    // permament workarounds
    case "GET /orgs/:org/projects":
      return "list-for-org";
    case "POST /orgs/:org/projects":
      return "create-for-org";
    case "GET /orgs/:org/repos":
      return "list-for-org";
    case "GET /rate_limit":
      return "get";
    case "PATCH /repos/:owner/:repo/check-suites/preferences":
      return "set-suites-preferences";
    case "GET /gists/:id/star":
      return "check-star";
    case "GET /repos/:owner/:repo/community/code_of_conduct":
      return "get-for-repo";
    case "GET /repos/:owner/:repo/license":
      return "get-for-repo";
    case "GET /repos/:owner/:repo/compare/:base...:head":
      return "compare-commits";
    case "PATCH /repos/:owner/:repo/import/lfs":
      return "set-lfs-preference";
    case "GET /repos/:owner/:repo/milestones/:milestone_number/labels":
      return "list-labels-for-milestone";
    case "GET /repos/:owner/:repo/pages":
      return "get-pages";
    case "GET /repos/:owner/:repo/projects":
      return "list-for-repo";
    case "POST /repos/:owner/:repo/projects":
      return "create-for-repo";
    case "PUT /repos/:owner/:repo/pulls/:pull_number/merge":
      return "merge";
    case "GET /repos/:owner/:repo/traffic/clones":
      return "get-clones";
    case "GET /repos/:owner/:repo/traffic/views":
      return "get-views";
    case "POST /scim/v2/organizations/:organization/Users":
      return "provision-and-invite-users";
    case "GET /scim/v2/organizations/:organization_id/Users":
      return "get-provisioned-identities-list";
    case "GET /teams/:id/repos/:owner/:repo":
      return "check-repo";
    case "GET /teams/:id/teams":
      return "list-child-teams";
    case "GET /users/:username/followers":
      return "list-followers-for-user";
    case "GET /users/:username/following":
      return "list-following-for-user";
    case "GET /users/:username/following/:target_user":
      return "check-following-for-user";
    case "GET /users/:username/gpg_keys":
      return "list-gpg-keys-for-user";
    case "GET /users/:username/received_events":
      return "list-received-events-for-user";
    case "GET /users/:username/received_events/public":
      return "list-received-public-events-for-user";
    case "GET /orgs/:org/blocks/:username":
      return "check-blocked-user";
    case "GET /networks/:owner/:repo/events":
      return "list-public-events-for-repo-network";
    case "GET /marketplace_listing/stubbed/accounts/:id":
      return "check-listing-for-account-stubbed";
    case "GET /marketplace_listing/accounts/:id":
      return "check-listing-for-account";
    case "GET /repos/:owner/:repo/issues/:issue_number/labels":
      return "list-labels-on-issue";
    case "GET /apps/:app_slug":
      return "get-by-slug";
    case "POST /user/projects":
      return "create-for-authenticated-user";
    case "GET /repos/:owner/:repo/vulnerability-alerts":
      return "check-vulnerability-alerts";
    case "POST /orgs/:org/repos":
      return "create-in-org";
    case "POST /user/repos":
      return "create-for-authenticated-user";
  }

  // workaround for stats routes: deviate idName for path
  if (/\/stats\//.test(route)) {
    const statIdName = kebabCase(route.split(/\/stats\//)[1]);
    return `get-${statIdName}-stats`;
  }

  // add scope singular/plural variations to fillWords
  const scopeNameVariations = getVariations(scope);
  const ignoreWords = FILL_WORDS.concat(scopeNameVariations);

  const forContextReplaceRegex = new RegExp(
    `(user|organization) (${scopeNameVariations.join("|")}.*)`,
    "ig"
  );
  const fillWordsRegex = new RegExp(`\\b(${ignoreWords.join("|")})\\b`, "ig");
  const ignoreWordsAtEndRegex = new RegExp(
    `\\b(${IGNORE_WORDS_AT_END.join("|")})\\s*$`,
    "i"
  );

  let idName = endpoint.operation.summary
    .replace(/\bin an?\b/, "for")
    .replace(forContextReplaceRegex, "$2 for $1")
    .replace(fillWordsRegex, "")
    .replace(ignoreWordsAtEndRegex, "");

  // some workarounds
  // idName = idName.replace(/for-and/, 'for')
  idName = idName.replace(/'s/, "");

  idName = kebabCase(idName);

  // shorter aliases
  idName = idName
    .replace("organization", "org")
    .replace("repository", "repo")
    .replace("repositories", "repos")
    .replace("reference", "ref")
    .replace("references", "refs");

  // Get list of -> list
  idName = idName.replace(/^get-list-of/, "list");

  // Download -> get
  idName = idName.replace(/^download/, "get");

  // "of for" might be a result of forContextReplaceRegex above, e.g. "Get the status of an organization migration"
  // gets turned into "Get  status of   for organization"
  idName = idName.replace(/of-for/, "for");

  // workaround for https://developer.github.com/v3/apps/#find-installations
  // "Find" is used only here, everywhere else it’s "list"
  idName = idName.replace(/^find-installations$/, "list-installations");

  // workaround for https://developer.github.com/v3/gitignore/#listing-available-templates
  idName = idName.replace(/^listing-/, "list-");

  // workaround for stubbed Marketplace endpoints such as
  // https://developer.github.com/v3/apps/marketplace/#list-all-plans-for-your-marketplace-listing
  idName = idName.replace(/for-stubbed$/, "stubbed");

  // workaround for https://developer.github.com/v3/activity/notifications/#view-a-single-thread
  idName = idName.replace(/^view\b/, "get");

  // user's membership -> membership
  idName = idName.replace(/user-membership/, "membership");

  // user-(as|is)-collaborator => collaborator
  idName = idName.replace(/user-(as|is)-collaborator/, "collaborator");

  // check-if-collaborator -> check-collaborator
  idName = idName.replace(/^check-if/, "check");

  // sha-1 -> sha
  idName = idName.replace(/\bsha-1/, "sha");

  // create tag object -> create tag
  // create tag name -> create tag
  idName = idName.replace(/tag-(object|name)/, "tag");

  // email addresses -> email
  idName = idName.replace(/email-address-?es/, "emails");
  idName = idName.replace(/email-address/, "email");

  // performed by -> for
  idName = idName.replace(/performed-by/, "for");

  // misc
  idName = idName.replace(/contextual-information/, "context");

  // get-admin-enforcement-of-protected-branch -> get-protected-branch-admin-enforcement
  if (/-of-/.test(idName)) {
    const parts = idName.split(/-of-/);
    idName = parts[0].replace(/-/, `-${parts[1]}-`);
  }

  if (scope === "users" && /^\/users\/:username\//.test(path)) {
    // user is special because some APIs are for the currently authenticated
    // user while others are APIs that require a username parameter. For examples
    // "list-followers" is the idName to list followers for the currently
    // authenticated user while "list-followers-for-user" is the idName to
    // list followers for a given username. So we don’t want to add back "for user"
    // to the idName.
    idName += "-for-user";
  }

  // if (/^\/user\//.test(endpoint.path)) {
  //   // opposite from the above. By default requests are for the currently authenticated user
  //   idName = idName.replace(/-for-user$/, '')
  // }

  // legacy endpoints
  if (/legacy/.test(path)) {
    idName += "-legacy";
  }

  // Edit XYZ -> Update XYZ
  idName = idName.replace(/^edit\b/, "update");

  return idName;
}

function getVariations(word) {
  const variations = [pluralize(word), pluralize.singular(word)];

  if (word === "apps") {
    variations.unshift("marketplace listing", "marketplace listings");
  }

  if (word === "checks") {
    variations.unshift("check run", "check runs");
  }

  if (word === "codesOfConduct") {
    variations.unshift("a repository's code of conduct");
    variations.unshift("code of conduct", "codes of conduct");
  }

  if (word === "oauthAuthorizations") {
    variations.unshift("authorization", "authorizations");
    variations.unshift("application", "applications");
    variations.unshift("app", "apps");
  }

  if (word === "orgs") {
    variations.unshift("organization", "organizations");
  }

  if (word === "pulls") {
    variations.unshift("pull request", "pull requests");
  }

  if (word === "repos") {
    variations.unshift("repository", "repositories");
  }

  return variations;
}

function assignResponse(responses, code, description, body, mediaType) {
  const intCode = parseInt(code || 418, 10);
  const response = (responses[intCode] = responses[intCode] || {});
  if (intCode === 418) {
    response.description = description || "Response definition missing";
    return;
  }
  if (intCode === 204) {
    response.description = description || "Empty response";
    return;
  }
  if (!response.description) {
    response.description =
      description || (intCode === 404 ? "Not Found" : "response");
  }
  if (body) {
    const bodyMediaType = mediaType || "application/json";
    response.content = response.content || {};
    response.content[bodyMediaType] = response.content[bodyMediaType] || {};
    response.content[bodyMediaType] = {
      schema: buildSchema(body)
    };
  }

  function buildSchema(body) {
    if (Array.isArray(body) && body[0] && typeof body[0] === "object") {
      return {
        type: "array",
        items: buildSchema(body[0])
      };
    }
    // WORKAROUND: speccy does not like {"type": null}
    const schema = mapValuesDeep(toJsonSchema(body), value =>
      value === "null" ? "string" : value
    );
    delete schema.$schema;
    return schema;
  }

  function mapValuesDeep(v, callback) {
    if (_.isArray(v)) {
      return v.map(innerObj => mapValuesDeep(innerObj, callback));
    }

    return _.isObject(v)
      ? _.mapValues(v, v => mapValuesDeep(v, callback))
      : callback(v);
  }
}
