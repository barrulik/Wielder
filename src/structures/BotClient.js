const { Client, Intents, Collection } = require("discord.js");
const consola = require("consola");
const path = require("path");
const { REST } = require("@discordjs/rest");
const { Routes } = require("discord-api-types/v9");
const fs = require("fs");

module.exports = class BotClient extends Client {
  constructor(token, dev_guild_id, client_id) {
    super({ intents: [new Intents(32767)] });

    this.token = token;
    this.guild_id = dev_guild_id;
    this.client_id = client_id;

    this.logger = consola;

    this.slashCommands = new Collection();

    this.normalCommands = new Collection();
  }

  async loadBot() {
    await this.loadModules();
    await this.login(this.token);
  }

  async loadModules() {
    /* Event Handler */

    const eventFolders = fs.readdirSync(
      path.resolve(__dirname, "..", "events")
    );

    for (const folder of eventFolders) {
      const eventFiles = fs
        .readdirSync(path.resolve(__dirname, "..", "events", `${folder}`))
        .filter((f) => f.endsWith(".js"));

      for (const file of eventFiles) {
        const event = require(`../events/${folder}/${file}`);
        if (event.config.once) {
          this.once(event.config.name, (...args) => event.run(...args));
        } else {
          this.on(event.config.name, (...args) => event.run(...args));
        }
      }
    }

    /* Slash Command Handler **/

    const commands = [];

    const commandFolders = fs.readdirSync(
      path.resolve(__dirname, "..", "slash-commands")
    );

    for (const folder of commandFolders) {
      const commandFiles = fs
        .readdirSync(
          path.resolve(__dirname, "..", "slash-commands", `${folder}`)
        )
        .filter((file) => file.endsWith(".js"));

      for (const file of commandFiles) {
        const slashCommand = require(`../slash-commands/${folder}/${file}`);
        this.slashCommands.set(slashCommand.data.name, slashCommand);
        commands.push(slashCommand.data.toJSON());
        this.logger.log(
          `[COMMANDS] Successfully loaded the (/) command ${slashCommand.data.name}`
        );
      }
    }

    const rest = new REST({ version: "9" }).setToken(this.token);
    (async () => {
      try {
        await rest.put(
          Routes.applicationGuildCommands(this.client_id, this.guild_id),
          { body: commands }
        );

        console.log("Commands successfully loaded Slash Commands.");
      } catch (err) {
        console.error(err);
      }
    })();

    this.on("interactionCreate", async (interaction) => {
      if (!interaction.isCommand()) return;

      // await interaction.deferReply();

      const command = this.slashCommands.get(interaction.commandName);
      if (!command) return;
      /*
  
        if (!interaction.memeber.permissions.has(command.permissions || [])) {
          return interaction.reply({
            content: "You do not have the permission to execute this command.",
            ephemeral: true,
          });
        }
        */

      try {
        await command.run(interaction, this);
      } catch (err) {
        console.error(err);
        return interaction.reply({
          content: "There was an error whilst executing this command.",
          ephemeral: true,
        });
      }
    });

    /* Normal Command Handler */

    const normalCommandFolders = fs.readdirSync(
      path.resolve(__dirname, "..", "normal-commands")
    );

    for (const folder of normalCommandFolders) {
      const eventFiles = fs
        .readdirSync(
          path.resolve(__dirname, "..", "normal-commands", `${folder}`)
        )
        .filter((f) => f.endsWith(".js"));

      for (const file of eventFiles) {
        const normalCommand = require(`../normal-commands/${folder}/${file}`);

        this.logger.log(
          `Sccessfully loaded normal command ${normalCommand.config.name}`
        );

        this.normalCommands.set(normalCommand.config.name, normalCommand);
      }
    }

    this.on("messageCreate", async (message) => {
      const prefix = "?";

      const args = message.content.slice(prefix.length).trim().split(/ +/g);
      const cmd = args.shift().toLowerCase();

      let command;

      if (!message.member) {
        message.member = await message.guild.members.fetch({
          user: message.author,
        });
      }

      if (!message.content.startsWith(prefix)) return;

      if (this.normalCommands.has(cmd)) command = this.normalCommands.get(cmd);

      if (command) {
       command.run(this, message, args)
      }
    });
  }
};