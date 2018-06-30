var mongoose = require('mongoose');
const Schema = mongoose.Schema;

var fileSchema = new Schema({
    name: string,
    data: { data: Buffer,contentType: string}
}) ;

var  fileModel = mongoose.model('fileSchema',fileSchema);
module.exports = fileModel;