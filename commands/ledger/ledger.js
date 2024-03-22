const { SlashCommandBuilder } = require('discord.js');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const { sheetId, tableId, googleEmail, googlePrivateKey, whitelistedDiscordUserIds } = require('../../config.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ledger')
        .setDescription('Update poker ledger')
        .addStringOption(option =>
            option.setName('url')
                .setDescription('The URL of the Poker Now game')
                .setRequired(true)
        ),
    async execute(interaction) {
        // If the user is not whitelisted, return an error
        if (!whitelistedDiscordUserIds.includes(interaction.user.id)) {
            return interaction.reply('You are not authorized to use this command');
        }

        const url = interaction.options.getString('url');

        // Example game URL: https://www.pokernow.club/games/pglijOn8fur6gGjOgFBhJ-ZOa
        // Extract game ID from URL using regex
        const gameId = url.match(/https:\/\/www\.pokernow\.club\/games\/([a-zA-Z0-9-_]+)/)[1];

        // If the game ID is not found, return an error
        if (!gameId) {
            return interaction.reply('Invalid game URL');
        }

        await interaction.reply(`Fetching ledger for game \`${gameId}\`...`);

        // Fetch ledger CSV from Poker Now
        const ledgerUrl = `https://www.pokernow.club/games/${gameId}/ledger_${gameId}.csv`;
        const ledgerResponse = await fetch(ledgerUrl);

        // If the ledger is not found, return an error
        if (!ledgerResponse.ok) {
            return interaction.editReply(`Unable to fetch ledger for game \`${gameId}\``);
        }

        const ledgerText = await ledgerResponse.text();

        // Parse CSV
        const ledger = ledgerText.split('\n').map(row => row.split(','));

        await interaction.editReply(`Fetched ledger for game \`${gameId}\`! Updating Google Sheet...`);

        // Initialize auth - see https://theoephraim.github.io/node-google-spreadsheet/#/guides/authentication
        const serviceAccountAuth = new JWT({
            // env var values here are copied from service account credentials generated by google
            // see "Authentication" section in docs for more info
            email: googleEmail,
            key: googlePrivateKey,
            scopes: [
                'https://www.googleapis.com/auth/spreadsheets',
            ],
        });

        const doc = new GoogleSpreadsheet(sheetId, serviceAccountAuth);
        await doc.loadInfo();

        const sheet = await doc.sheetsById[tableId];

        // Append rows to the sheet
        await sheet.addRows(ledger);

        await interaction.editReply(`Updated Google Sheet with ledger for game \`${gameId}\`!`);
    },
};