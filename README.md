# CircleCI Workflow Terminator

A bot to cancel redundant builds from CircleCi workflows.

<p align="center">
  <img src="https://user-images.githubusercontent.com/7189823/41366971-b869673a-6f0b-11e8-8c92-438ff3ad6b2c.png" height="200" />
  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
  <img src="https://user-images.githubusercontent.com/7189823/41366882-78bad416-6f0b-11e8-98fa-18ea1b6219e1.png" height="200" />
</p>

<p align="center"><i>It won't be back!</i></p>

Since CircleCI 2.0, the option to auto-cancel redundant builds does not apply to workflows.

The main goal of this repository is to provide a way to cancel redundant builds from a CircleCI workflow with minimal changes.

To achieve that, this bot will be triggered by GitHub push events and will cancel redundant builds if needs with the CircleCI API.

## Setup

[![Deploy to Heroku](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy)

[![Deploy to now](https://deploy.now.sh/static/button.svg)](https://deploy.now.sh/?repo=https://github.com/charpeni/circleci-workflow-terminator&env=CIRCLE_TOKEN)

1.  Generate a [CircleCI Personal API Token](https://circleci.com/docs/2.0/managing-api-tokens/#creating-a-personal-api-token).
1.  Deploy this bot somewhere like on [Heroku](https://www.heroku.com/) or [Now](https://zeit.co/now).
1.  Add `CIRCLE_TOKEN` with your CircleCI Personal API Token to the environment variables.
1.  Add a Webhook to your deployed bot into your GitHub repository with only push events.

You're good to go. 🎉

## License

CircleCI Workflow Terminator is [MIT Licensed](LICENSE).
