"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("@aws-cdk/assert");
const cdk = require("@aws-cdk/core");
const CdkTempleteAdditionalEdition = require("../lib/cdk-templete-additional-edition-stack");
test('Empty Stack', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new CdkTempleteAdditionalEdition.CdkTempleteAdditionalEditionStack(app, 'MyTestStack');
    // THEN
    assert_1.expect(stack).to(assert_1.matchTemplate({
        "Resources": {}
    }, assert_1.MatchStyle.EXACT));
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2RrLXRlbXBsZXRlLWFkZGl0aW9uYWwtZWRpdGlvbi50ZXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiY2RrLXRlbXBsZXRlLWFkZGl0aW9uYWwtZWRpdGlvbi50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsNENBQWlGO0FBQ2pGLHFDQUFxQztBQUNyQyw2RkFBNkY7QUFFN0YsSUFBSSxDQUFDLGFBQWEsRUFBRSxHQUFHLEVBQUU7SUFDckIsTUFBTSxHQUFHLEdBQUcsSUFBSSxHQUFHLENBQUMsR0FBRyxFQUFFLENBQUM7SUFDMUIsT0FBTztJQUNQLE1BQU0sS0FBSyxHQUFHLElBQUksNEJBQTRCLENBQUMsaUNBQWlDLENBQUMsR0FBRyxFQUFFLGFBQWEsQ0FBQyxDQUFDO0lBQ3JHLE9BQU87SUFDUCxlQUFTLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLHNCQUFhLENBQUM7UUFDaEMsV0FBVyxFQUFFLEVBQUU7S0FDaEIsRUFBRSxtQkFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUE7QUFDekIsQ0FBQyxDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBleHBlY3QgYXMgZXhwZWN0Q0RLLCBtYXRjaFRlbXBsYXRlLCBNYXRjaFN0eWxlIH0gZnJvbSAnQGF3cy1jZGsvYXNzZXJ0JztcbmltcG9ydCAqIGFzIGNkayBmcm9tICdAYXdzLWNkay9jb3JlJztcbmltcG9ydCAqIGFzIENka1RlbXBsZXRlQWRkaXRpb25hbEVkaXRpb24gZnJvbSAnLi4vbGliL2Nkay10ZW1wbGV0ZS1hZGRpdGlvbmFsLWVkaXRpb24tc3RhY2snO1xuXG50ZXN0KCdFbXB0eSBTdGFjaycsICgpID0+IHtcbiAgICBjb25zdCBhcHAgPSBuZXcgY2RrLkFwcCgpO1xuICAgIC8vIFdIRU5cbiAgICBjb25zdCBzdGFjayA9IG5ldyBDZGtUZW1wbGV0ZUFkZGl0aW9uYWxFZGl0aW9uLkNka1RlbXBsZXRlQWRkaXRpb25hbEVkaXRpb25TdGFjayhhcHAsICdNeVRlc3RTdGFjaycpO1xuICAgIC8vIFRIRU5cbiAgICBleHBlY3RDREsoc3RhY2spLnRvKG1hdGNoVGVtcGxhdGUoe1xuICAgICAgXCJSZXNvdXJjZXNcIjoge31cbiAgICB9LCBNYXRjaFN0eWxlLkVYQUNUKSlcbn0pO1xuIl19