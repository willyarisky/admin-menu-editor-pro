/// <reference path="../../../js/knockout.d.ts" />
/// <reference path="../../../js/jquery.d.ts" />
/// <reference path="../../../js/lodash-3.10.d.ts" />
/// <reference path="../../../modules/actor-selector/actor-selector.ts" />
/// <reference path="../../../js/jquery.biscuit.d.ts" />
/// <reference path="../../ko-dialog-bindings.ts" />
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var AmeTweakItem = /** @class */ (function () {
    function AmeTweakItem(properties, module) {
        var _this = this;
        this.initialProperties = null;
        this.editableProperties = {};
        this.section = null;
        this.parent = null;
        this.isUserDefined = properties.isUserDefined ? properties.isUserDefined : false;
        if (this.isUserDefined) {
            this.initialProperties = properties;
        }
        this.id = properties.id;
        if (this.isUserDefined) {
            this.label = ko.observable(properties.label);
        }
        else {
            this.label = ko.pureComputed(function () {
                return properties.label;
            });
        }
        this.children = ko.observableArray([]);
        this.module = module;
        this.enabledForActor = new AmeObservableActorSettings(properties.enabledForActor || null);
        var _isIndeterminate = ko.observable(false);
        this.isIndeterminate = ko.computed(function () {
            if (module.selectedActor() !== null) {
                return false;
            }
            return _isIndeterminate();
        });
        this.isChecked = ko.computed({
            read: function () {
                var selectedActor = _this.module.selectedActor();
                if (selectedActor === null) {
                    //All: Checked only if it's checked for all actors.
                    var allActors = _this.module.actorSelector.getVisibleActors();
                    var isEnabledForAll = true, isEnabledForAny = false;
                    for (var index = 0; index < allActors.length; index++) {
                        if (_this.enabledForActor.get(allActors[index].getId(), false)) {
                            isEnabledForAny = true;
                        }
                        else {
                            isEnabledForAll = false;
                        }
                    }
                    _isIndeterminate(isEnabledForAny && !isEnabledForAll);
                    return isEnabledForAll;
                }
                //Is there an explicit setting for this actor?
                var ownSetting = _this.enabledForActor.get(selectedActor.getId(), null);
                if (ownSetting !== null) {
                    return ownSetting;
                }
                if (selectedActor instanceof AmeUser) {
                    //The "Super Admin" setting takes precedence over regular roles.
                    if (selectedActor.isSuperAdmin) {
                        var superAdminSetting = _this.enabledForActor.get(AmeSuperAdmin.permanentActorId, null);
                        if (superAdminSetting !== null) {
                            return superAdminSetting;
                        }
                    }
                    //Is it enabled for any of the user's roles?
                    for (var i = 0; i < selectedActor.roles.length; i++) {
                        var groupSetting = _this.enabledForActor.get('role:' + selectedActor.roles[i], null);
                        if (groupSetting === true) {
                            return true;
                        }
                    }
                }
                //All tweaks are unchecked by default.
                return false;
            },
            write: function (checked) {
                var selectedActor = _this.module.selectedActor();
                if (selectedActor === null) {
                    //Enable/disable this tweak for all actors.
                    if (checked === false) {
                        //Since false is the default, this is the same as removing/resetting all values.
                        _this.enabledForActor.resetAll();
                    }
                    else {
                        var allActors = _this.module.actorSelector.getVisibleActors();
                        for (var i = 0; i < allActors.length; i++) {
                            _this.enabledForActor.set(allActors[i].getId(), checked);
                        }
                    }
                }
                else {
                    _this.enabledForActor.set(selectedActor.getId(), checked);
                }
                //Apply the same setting to all children.
                var children = _this.children();
                for (var i = 0; i < children.length; i++) {
                    children[i].isChecked(checked);
                }
            }
        });
        if (properties.userInput) {
            this.userInput = AmeTweakInput.create(properties.userInput, module);
            var contentProperty = properties.userInput.contentProperty || 'userInputValue';
            var propertyObservable = this.getEditableProperty(contentProperty, properties);
            if (propertyObservable !== null) {
                this.userInput.setInputObservable(propertyObservable);
            }
        }
    }
    AmeTweakItem.prototype.toJs = function () {
        //Since all tweaks are disabled by default, having a tweak disabled for a role is the same
        //as not having a setting, so we can save some space by removing it. This does not always
        //apply to users/Super Admins because they can have precedence over roles.
        var temp = this.enabledForActor.getAll();
        var enabled = {};
        var areAllFalse = true;
        for (var actorId in temp) {
            if (!temp.hasOwnProperty(actorId)) {
                continue;
            }
            areAllFalse = areAllFalse && (!temp[actorId]);
            if (!temp[actorId]) {
                var actor = AmeActors.getActor(actorId);
                if (actor instanceof AmeRole) {
                    continue;
                }
            }
            enabled[actorId] = temp[actorId];
        }
        if (areAllFalse) {
            enabled = {};
        }
        var result = {
            id: this.id,
            enabledForActor: enabled
        };
        if (this.userInput) {
            var inputValue = this.userInput.getInputValue();
            if ((inputValue !== '') && (inputValue !== null)) {
                result[this.userInput.contentProperty] = inputValue;
            }
        }
        if (!this.isUserDefined) {
            return result;
        }
        else {
            var props = result;
            props.isUserDefined = this.isUserDefined;
            props.label = this.label();
            props.sectionId = this.section ? this.section.id : null;
            props.parentId = this.parent ? this.parent.id : null;
            var _1 = AmeTweakManagerModule._;
            var editableProps_1 = {};
            _1.forOwn(this.editableProperties, function (observable, key) {
                editableProps_1[key] = observable();
            });
            props = _1.defaults(props, editableProps_1, _1.omit(this.initialProperties, 'userInputValue', 'enabledForActor'));
            return props;
        }
    };
    AmeTweakItem.prototype.setSection = function (section) {
        this.section = section;
        return this;
    };
    AmeTweakItem.prototype.setParent = function (tweak) {
        this.parent = tweak;
        return this;
    };
    AmeTweakItem.prototype.getSection = function () {
        return this.section;
    };
    AmeTweakItem.prototype.getParent = function () {
        return this.parent;
    };
    AmeTweakItem.prototype.addChild = function (tweak) {
        this.children.push(tweak);
        tweak.setParent(this);
        return this;
    };
    AmeTweakItem.prototype.removeChild = function (tweak) {
        this.children.remove(tweak);
    };
    AmeTweakItem.prototype.getEditableProperty = function (key, storedProperties) {
        if (this.editableProperties.hasOwnProperty(key)) {
            return this.editableProperties[key];
        }
        if (!storedProperties && this.initialProperties) {
            storedProperties = this.initialProperties;
        }
        if (storedProperties && storedProperties.hasOwnProperty(key)) {
            var observable = ko.observable(storedProperties[key]);
            this.editableProperties[key] = observable;
            return observable;
        }
        if (console && console.warn) {
            console.warn('Trying to retrieve and edit a non-existing property "%s"', key);
        }
        return ko.observable('');
    };
    AmeTweakItem.prototype.getTypeId = function () {
        if (!this.isUserDefined || !this.initialProperties) {
            return null;
        }
        if (this.initialProperties.typeId) {
            return this.initialProperties.typeId;
        }
        return null;
    };
    return AmeTweakItem;
}());
var AmeTweakSection = /** @class */ (function () {
    function AmeTweakSection(properties) {
        this.footerTemplateName = null;
        this.id = properties.id;
        this.label = properties.label;
        this.isOpen = ko.observable(true);
        this.tweaks = ko.observableArray([]);
    }
    AmeTweakSection.prototype.addTweak = function (tweak) {
        this.tweaks.push(tweak);
        tweak.setSection(this);
    };
    AmeTweakSection.prototype.removeTweak = function (tweak) {
        this.tweaks.remove(tweak);
    };
    AmeTweakSection.prototype.hasContent = function () {
        return this.tweaks().length > 0;
    };
    AmeTweakSection.prototype.toggle = function () {
        this.isOpen(!this.isOpen());
    };
    return AmeTweakSection;
}());
var AmeTweakInput = /** @class */ (function () {
    function AmeTweakInput() {
        this.syntaxHighlightingOptions = null;
    }
    AmeTweakInput.prototype.setInputObservable = function (observable) {
        this.inputValue = observable;
    };
    AmeTweakInput.prototype.getInputValue = function () {
        return this.inputValue();
    };
    ;
    AmeTweakInput.prototype.setInputValue = function (value) {
        this.inputValue(value);
    };
    ;
    AmeTweakInput.create = function (properties, module) {
        var input;
        switch (properties.inputType) {
            case 'textarea':
                input = new AmeTweakTextAreaInput(properties, module);
                break;
            case 'text':
            default:
                throw { 'message': 'Input type not implemented' };
        }
        if (properties.contentProperty) {
            input.contentProperty = properties.contentProperty;
        }
        return input;
    };
    return AmeTweakInput;
}());
var AmeTweakTextAreaInput = /** @class */ (function (_super) {
    __extends(AmeTweakTextAreaInput, _super);
    function AmeTweakTextAreaInput(properties, module) {
        var _this = _super.call(this) || this;
        _this.templateName = 'ame-tweak-textarea-input-template';
        _this.inputValue = ko.observable('');
        if (properties.syntaxHighlighting && module) {
            _this.syntaxHighlightingOptions = module.getCodeMirrorOptions(properties.syntaxHighlighting);
        }
        return _this;
    }
    return AmeTweakTextAreaInput;
}(AmeTweakInput));
var AmeTweakManagerModule = /** @class */ (function () {
    function AmeTweakManagerModule(scriptData) {
        var _this = this;
        this.tweaksById = {};
        this.sectionsById = {};
        this.sections = [];
        this.lastUserTweakSuffix = 0;
        var _ = AmeTweakManagerModule._;
        this.actorSelector = new AmeActorSelector(AmeActors, scriptData.isProVersion);
        this.selectedActorId = this.actorSelector.createKnockoutObservable(ko);
        this.selectedActor = ko.computed(function () {
            var id = _this.selectedActorId();
            if (id === null) {
                return null;
            }
            return AmeActors.getActor(id);
        });
        //Reselect the previously selected actor.
        this.selectedActorId(scriptData.selectedActor);
        //Set syntax highlighting options.
        this.cssHighlightingOptions = _.merge({}, scriptData.defaultCodeEditorSettings, {
            'codemirror': {
                'mode': 'css',
                'lint': true,
                'autoCloseBrackets': true,
                'matchBrackets': true
            }
        });
        //Sort sections by priority, then by label.
        var sectionData = _.sortByAll(scriptData.sections, ['priority', 'label']);
        //Register sections.
        _.forEach(sectionData, function (properties) {
            var section = new AmeTweakSection(properties);
            _this.sectionsById[section.id] = section;
            _this.sections.push(section);
        });
        var firstSection = this.sections[0];
        _.forEach(scriptData.tweaks, function (properties) {
            var tweak = new AmeTweakItem(properties, _this);
            _this.tweaksById[tweak.id] = tweak;
            if (properties.parentId && _this.tweaksById.hasOwnProperty(properties.parentId)) {
                _this.tweaksById[properties.parentId].addChild(tweak);
            }
            else {
                var ownerSection = firstSection;
                if (properties.sectionId && _this.sectionsById.hasOwnProperty(properties.sectionId)) {
                    ownerSection = _this.sectionsById[properties.sectionId];
                }
                ownerSection.addTweak(tweak);
            }
        });
        //Remove empty sections.
        this.sections = _.filter(this.sections, function (section) {
            return section.hasContent();
        });
        //Add the tweak creation button to the Admin CSS section.
        if (this.sectionsById.hasOwnProperty('admin-css')) {
            this.sectionsById['admin-css'].footerTemplateName = 'ame-admin-css-section-footer';
        }
        //By default, all sections except the first one are closed.
        //The user can open/close sections and we automatically remember their state.
        this.openSectionIds = ko.computed({
            read: function () {
                var result = [];
                _.forEach(_this.sections, function (section) {
                    if (section.isOpen()) {
                        result.push(section.id);
                    }
                });
                return result;
            },
            write: function (sectionIds) {
                var openSections = _.indexBy(sectionIds);
                _.forEach(_this.sections, function (section) {
                    section.isOpen(openSections.hasOwnProperty(section.id));
                });
            }
        });
        this.openSectionIds.extend({ rateLimit: { timeout: 1000, method: 'notifyWhenChangesStop' } });
        var initialState = null;
        var cookieValue = jQuery.cookie(AmeTweakManagerModule.openSectionCookieName);
        if ((typeof cookieValue === 'string') && JSON && JSON.parse) {
            var storedState = JSON.parse(cookieValue);
            if (_.isArray(storedState)) {
                initialState = _.intersection(_.keys(this.sectionsById), storedState);
            }
        }
        if (initialState !== null) {
            this.openSectionIds(initialState);
        }
        else {
            this.openSectionIds([_.first(this.sections).id]);
        }
        this.openSectionIds.subscribe(function (sectionIds) {
            jQuery.cookie(AmeTweakManagerModule.openSectionCookieName, ko.toJSON(sectionIds), { expires: 90 });
        });
        if (scriptData.lastUserTweakSuffix) {
            this.lastUserTweakSuffix = scriptData.lastUserTweakSuffix;
        }
        this.adminCssEditorDialog = new AmeEditAdminCssDialog(this);
        this.settingsData = ko.observable('');
        this.isSaving = ko.observable(false);
    }
    AmeTweakManagerModule.prototype.saveChanges = function () {
        this.isSaving(true);
        var _ = wsAmeLodash;
        var data = {
            'tweaks': _.indexBy(_.invoke(this.tweaksById, 'toJs'), 'id'),
            'lastUserTweakSuffix': this.lastUserTweakSuffix
        };
        this.settingsData(ko.toJSON(data));
        return true;
    };
    AmeTweakManagerModule.prototype.addAdminCssTweak = function (label, css) {
        this.lastUserTweakSuffix++;
        var slug = this.slugify(label);
        if (slug !== '') {
            slug = '-' + slug;
        }
        var props = {
            label: label,
            id: 'utw-' + this.lastUserTweakSuffix + slug,
            isUserDefined: true,
            sectionId: 'admin-css',
            typeId: 'admin-css'
        };
        props['css'] = css;
        props.userInput = {
            contentProperty: 'css',
            syntaxHighlighting: 'css',
            inputType: 'textarea'
        };
        var newTweak = new AmeTweakItem(props, this);
        this.tweaksById[newTweak.id] = newTweak;
        this.sectionsById['admin-css'].addTweak(newTweak);
    };
    AmeTweakManagerModule.prototype.slugify = function (input) {
        var _ = AmeTweakManagerModule._;
        var output = _.deburr(input);
        output = output.replace(/[^a-zA-Z0-9]/, '');
        return _.kebabCase(output);
    };
    AmeTweakManagerModule.prototype.launchTweakEditor = function (tweak) {
        // noinspection JSRedundantSwitchStatement
        switch (tweak.getTypeId()) {
            case 'admin-css':
                this.adminCssEditorDialog.selectedTweak = tweak;
                this.adminCssEditorDialog.open();
                break;
            default:
                alert('Error: Editor not implemented! This is probably a bug.');
        }
    };
    AmeTweakManagerModule.prototype.confirmDeleteTweak = function (tweak) {
        if (!tweak.isUserDefined || !confirm('Delete this tweak?')) {
            return;
        }
        this.deleteTweak(tweak);
    };
    AmeTweakManagerModule.prototype.deleteTweak = function (tweak) {
        var section = tweak.getSection();
        if (section) {
            section.removeTweak(tweak);
        }
        var parent = tweak.getParent();
        if (parent) {
            parent.removeChild(tweak);
        }
        delete this.tweaksById[tweak.id];
    };
    AmeTweakManagerModule.prototype.getCodeMirrorOptions = function (mode) {
        if (mode === 'css') {
            return this.cssHighlightingOptions;
        }
        return null;
    };
    AmeTweakManagerModule._ = wsAmeLodash;
    AmeTweakManagerModule.openSectionCookieName = 'ame_tmce_open_sections';
    return AmeTweakManagerModule;
}());
var AmeEditAdminCssDialog = /** @class */ (function () {
    function AmeEditAdminCssDialog(manager) {
        var _this = this;
        this.autoCancelButton = false;
        this.options = {
            minWidth: 400
        };
        this.selectedTweak = null;
        var _ = AmeTweakManagerModule._;
        this.manager = manager;
        this.tweakLabel = ko.observable('');
        this.cssCode = ko.observable('');
        this.confirmButtonText = ko.observable('Add Snippet');
        this.title = ko.observable(null);
        this.isAddButtonEnabled = ko.computed(function () {
            return !((_.trim(_this.tweakLabel()) === '') || (_.trim(_this.cssCode()) === ''));
        });
        this.isOpen = ko.observable(false);
    }
    AmeEditAdminCssDialog.prototype.onOpen = function (event, ui) {
        if (this.selectedTweak) {
            this.tweakLabel(this.selectedTweak.label());
            this.title('Edit admin CSS snippet');
            this.confirmButtonText('Save Changes');
            var cssProperty = this.selectedTweak.getEditableProperty('css');
            this.cssCode(cssProperty ? cssProperty() : '');
        }
        else {
            this.tweakLabel('');
            this.cssCode('');
            this.title('Add admin CSS snippet');
            this.confirmButtonText('Add Snippet');
        }
    };
    AmeEditAdminCssDialog.prototype.onConfirm = function () {
        if (this.selectedTweak) {
            //Update the existing tweak.
            this.selectedTweak.label(this.tweakLabel());
            this.selectedTweak.getEditableProperty('css')(this.cssCode());
        }
        else {
            //Create a new tweak.
            this.manager.addAdminCssTweak(this.tweakLabel(), this.cssCode());
        }
        this.close();
    };
    AmeEditAdminCssDialog.prototype.onClose = function () {
        this.selectedTweak = null;
    };
    AmeEditAdminCssDialog.prototype.close = function () {
        this.isOpen(false);
    };
    AmeEditAdminCssDialog.prototype.open = function () {
        this.isOpen(true);
    };
    return AmeEditAdminCssDialog;
}());
//A one-way binding for indeterminate checkbox states.
ko.bindingHandlers['indeterminate'] = {
    update: function (element, valueAccessor) {
        element.indeterminate = !!(ko.unwrap(valueAccessor()));
    }
};
ko.bindingHandlers.ameCodeMirror = {
    init: function (element, valueAccessor, allBindings) {
        if (!wp.hasOwnProperty('codeEditor') || !wp.codeEditor.initialize) {
            return;
        }
        var parameters = ko.unwrap(valueAccessor());
        if (!parameters) {
            return;
        }
        var options;
        var refreshTrigger;
        if (parameters.options) {
            options = parameters.options;
            if (parameters.refreshTrigger) {
                refreshTrigger = parameters.refreshTrigger;
            }
        }
        else {
            options = parameters;
        }
        var result = wp.codeEditor.initialize(element, options);
        var cm = result.codemirror;
        //Synchronise the editor contents with the observable passed to the "value" binding.
        var valueObservable = allBindings.get('value');
        if (!ko.isObservable(valueObservable)) {
            valueObservable = null;
        }
        var subscription = null;
        var changeHandler = null;
        if (valueObservable !== null) {
            //Update the observable when the contents of the editor change.
            var ignoreNextUpdate_1 = false;
            changeHandler = function () {
                //This will trigger our observable subscription (see below).
                //We need to ignore that trigger to avoid recursive or duplicated updates.
                ignoreNextUpdate_1 = true;
                valueObservable(cm.doc.getValue());
            };
            cm.on('changes', changeHandler);
            //Update the editor when the observable changes.
            subscription = valueObservable.subscribe(function (newValue) {
                if (ignoreNextUpdate_1) {
                    ignoreNextUpdate_1 = false;
                    return;
                }
                cm.doc.setValue(newValue);
                ignoreNextUpdate_1 = false;
            });
        }
        //Refresh the size of the editor element when an observable changes value.
        var refreshSubscription = null;
        if (refreshTrigger) {
            refreshSubscription = refreshTrigger.subscribe(function () {
                cm.refresh();
            });
        }
        ko.utils.domNodeDisposal.addDisposeCallback(element, function () {
            //Remove subscriptions and event handlers.
            if (subscription) {
                subscription.dispose();
            }
            if (refreshSubscription) {
                refreshSubscription.dispose();
            }
            if (changeHandler) {
                cm.off('changes', changeHandler);
            }
            //Destroy the CodeMirror instance.
            jQuery(cm.getWrapperElement()).remove();
        });
    }
};
jQuery(function () {
    ameTweakManager = new AmeTweakManagerModule(wsTweakManagerData);
    ko.applyBindings(ameTweakManager, document.getElementById('ame-tweak-manager'));
});
