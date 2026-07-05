# Privacy

PetPresence is local-first by default.

## Default Creator Pipeline

The default workflow creates and runs a desktop pet from local files:

- pet profiles under `data/pets/<pet_id>/`;
- action assets under `assets/pets/<pet_id>/`;
- optional local frame or report outputs.

These files stay on your machine unless you explicitly upload, publish, or commit them.

See `docs/media_and_data_policy.md` for the repository policy on which media and generated files may be published.

## External Model Providers

Video generation APIs and multimodal APIs are optional. If you use one, your images, videos, prompts, or extracted frames may be sent to that provider. Review the provider's policy before uploading private pet media.

Never commit real API keys. Use `.env` or your shell environment, and keep `.env` out of git.

## Demo And Experimental Logs

Experimental event-server and observer modules may write JSONL events, extracted frames, and generated reports under `data/pets/<pet_id>/`. Treat these as private local data unless you intentionally publish them.

The `outputs/` directory is also treated as local generated data by default.

## Safety Boundary

PetPresence should describe observable behavior and user-provided personality. It must not claim to diagnose pet health, psychology, pain, anxiety, disease, or safety conditions.
