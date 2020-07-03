const fs = require('fs');
const metadata = require('./metadata2');
const axios = require('axios');
require('dotenv').config();

const elementKeys = ['sugarsell']
const options = {
    method: 'GET',
    headers:
    {
        Authorization: process.env.AUTHORIZATION,
        accept: 'application/json',
        'Content-Type': 'application/json'
    },
    json: true
};

async function getElementByKey(metadata) {
    try {
        fs.exists('sqlfile.sql', exists => {
            if(exists) {
                fs.unlinkSync('sqlfile.sql');
            }
        })
        const keys = metadata.map(md => md.key);
        for (let i = 0; i < keys.length; i++) {
            options['url'] = `${process.env.API_URL}/elements/${keys[i]}`;
            const response = await axios(options);
            buildQuery(response.data, metadata.filter(md => md.key === keys[i])[0]);
        }
    } catch (err) {
        console.log("Error at getElementByKey : ", err)
    }
}

function buildQuery(elementData, metadata) {
    const minSize = 1;
    let defaultSize = 50;
    if (metadata.maxSize < 50) {
        defaultSize = metadata.maxSize;
    }
    let paginationDefaultValue = `{\"minPageSize\":${minSize},\"maxPageSize\":${metadata.maxSize},\"defaultPageSize\":${defaultSize}}`
    let query = `insert into element_config(property_name, property_key, property_description, default_value, active, deleted, mandatory, display_order, hide, reseller_config, account_config, internal, encrypt, element_id, config_type_id, owner_account_id) values ('Pagination', 'pagination', '${elementData.name} Pagination', '${paginationDefaultValue}', '1', '0', '0', 1, '1', '0', '0', '0', '0', (select element_id from element where element_key='${metadata.key}' and element_owner_account_id = (select account_id from ce_core_user where email_address = 'system')), (select config_type_id from config_type_lkp where type_short_name='TEXTFIELD_32'), (select account_id from ce_core_user where email_address = 'system'));` + '\r\n';
    query += `update element set paginator_version='V3' where element_id=(select element_id from element where element_key='${metadata.key}' and element_owner_account_id=(select account_id from ce_core_user where email_address='system'));` + '\r\n';
    if (elementData && elementData.resources) {
        elementData.resources.map(resource => {
            if (resource.method === 'GET' && resource.rootKey && resource.hooks.length > 0) {
                let postHook = resource.hooks.filter(hook => hook.type === 'postRequest');
                if (postHook.length == 1) {
                    postHookBody = postHook[0]['body'].replace(/([\r\n])/gm,"\\n");
                    const rootKey = resource.rootKey.replace(/\W+/gm,'');
                    let regexExp = new RegExp(`(\\['${rootKey}'\\])|(\\.${rootKey})`, 'gmi');
                    if (regexExp.test(postHookBody)) {
                        postHookBody = postHookBody.replace(regexExp, '');
                        query += `update element_resource_hook set body = '${postHookBody.replace(/'/gm, '\'\'')}' where element_resource_id = ( select id from element_resource where element_id = (select element_id from element where element_key = '${metadata.key}'  and deleted = false and element_owner_account_id = (select account_id from ce_core_user where email_address = 'system')) and owner_account_id = (select account_id from ce_core_user where email_address = 'system') and path = '${resource.path}' and method = '${resource.method}' and type = '${resource.type}' ) and mime_type = '${postHook[0].mimeType}' and type = '${postHook[0].type}';` + '\r\n';
                    }
                }
            }
        })
    }
    query += '\r\n';
    writeQueryToFile(query);
}

function writeQueryToFile(data) {
    fs.appendFile('sqlfile.sql', data, function (err) {
        if (err) throw err;
        console.log('Updated!');
    });
}

getElementByKey(metadata);