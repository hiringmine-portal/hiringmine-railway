// import JobAd from "./models/JobAd.js";
// import cron from 'node-cron';

// // Define and schedule the cron job
// export default cron.schedule('0 0 * * *', async () => {
//     try {
//         // Find all sponsored job ads where sponsoredExpiry is in the past
//         console.log('Updating sponsorship status...')
//         // return
//         const expiredSponsorships = await JobAd.find({
//             sponsored: true,
//             sponsoredExpiry: { $lt: new Date() } // Find sponsorships that have expired
//         });

//         // Update sponsored field to false for expired sponsorships
//         await JobAd.updateMany(
//             { _id: { $in: expiredSponsorships.map(ad => ad._id) } },
//             { $set: { sponsored: false } }
//         );

//         console.log('Sponsorship status updated successfully.');
//     } catch (err) {
//         console.error('Error updating sponsorship status:', err);
//     }
// });