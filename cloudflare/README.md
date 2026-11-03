# Cloudflare deployment

The public game is served at <https://squish.chemisgreat.online/> by a static Cloudflare Worker. The asset directory in `wrangler.jsonc` points to `../browser/dist`; there is no build step or server-side application.

From this directory, authenticate with your Cloudflare account and deploy:

```sh
npx --yes wrangler@4.156.2 login
npx --yes wrangler@4.156.2 deploy
```

Select the Cloudflare account that owns `chemisgreat.online` if prompted. The account ID is intentionally omitted from the shared configuration. Authentication is stored by Wrangler outside the project; never commit tokens or local Wrangler files.

The configuration uses the `squish-pocket` Worker and its custom domain `squish.chemisgreat.online`. Cloudflare manages DNS and HTTPS for this hostname. If deploying a separate copy, change the Worker name and custom domain to ones you own first. Existing unrelated domains and Workers should be left intact. `workers_dev` and preview URLs are disabled.

User progress is saved in each browser's local storage and is specific to the site origin. Deployments contain no user saves or server secrets.
